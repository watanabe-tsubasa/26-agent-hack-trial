import { randomUUID } from "crypto";
import { getDbPool, sql } from "./db";
import type { CreateReportInput, Report } from "./types";

export async function createQueuedReport(input: CreateReportInput): Promise<string> {
  const pool = await getDbPool();
  const id = `report_${randomUUID()}`;

  await pool
    .request()
    .input("id", sql.NVarChar, id)
    .input("status", sql.NVarChar, "queued")
    .input("summary", sql.NVarChar, input.summary)
    .input("inputJson", sql.NVarChar, JSON.stringify(input))
    .query(`
      insert into reports (id, status, summary, input_json)
      values (@id, @status, @summary, @inputJson)
    `);

  return id;
}

export async function updateReportStatus(
  reportId: string,
  status: string,
  errorMessage?: string
): Promise<void> {
  const pool = await getDbPool();

  await pool
    .request()
    .input("id", sql.NVarChar, reportId)
    .input("status", sql.NVarChar, status)
    .input("errorMessage", sql.NVarChar, errorMessage ?? null)
    .query(`
      update reports
      set status = @status,
          error_message = @errorMessage,
          updated_at = sysutcdatetime()
      where id = @id
    `);
}

export async function saveAiDraft(reportId: string, draft: Report): Promise<void> {
  const pool = await getDbPool();

  await pool
    .request()
    .input("id", sql.NVarChar, reportId)
    .input("aiDraftJson", sql.NVarChar, JSON.stringify(draft))
    .query(`
      update reports
      set status = 'waiting_human_review',
          ai_draft_json = @aiDraftJson,
          updated_at = sysutcdatetime()
      where id = @id
    `);
}

export async function saveUserDraft(reportId: string, draft: Report): Promise<void> {
  const pool = await getDbPool();

  await pool
    .request()
    .input("id", sql.NVarChar, reportId)
    .input("userDraftJson", sql.NVarChar, JSON.stringify(draft))
    .input("feedbacksJson", sql.NVarChar, JSON.stringify(draft.feedbacks ?? []))
    .query(`
      update reports
      set status = 'updated',
          user_draft_json = @userDraftJson,
          feedbacks_json = @feedbacksJson,
          updated_at = sysutcdatetime()
      where id = @id
    `);
}

export async function confirmReport(reportId: string): Promise<void> {
  const pool = await getDbPool();

  await pool
    .request()
    .input("id", sql.NVarChar, reportId)
    .query(`
      update reports
      set status = 'confirmed',
          updated_at = sysutcdatetime()
      where id = @id
    `);
}

export async function getReportById(reportId: string): Promise<Report | null> {
  const pool = await getDbPool();

  const result = await pool
    .request()
    .input("id", sql.NVarChar, reportId)
    .query<ListRow & { input_json: string | null; error_message: string | null }>(`
      select top 1
        id, status, summary, input_json, ai_draft_json, user_draft_json, error_message, created_at, updated_at
      from reports
      where id = @id
    `);

  const row = result.recordset[0];
  if (!row) return null;

  return rowToPartialReport(row);
}

export async function getReportStatus(
  reportId: string
): Promise<{ id: string; status: string; error_message: string | null; updated_at: Date } | null> {
  const pool = await getDbPool();

  const result = await pool
    .request()
    .input("id", sql.NVarChar, reportId)
    .query(`
      select top 1 id, status, error_message, updated_at
      from reports
      where id = @id
    `);

  return result.recordset[0] ?? null;
}

export async function getInputJson(reportId: string): Promise<CreateReportInput | null> {
  const pool = await getDbPool();

  const result = await pool
    .request()
    .input("id", sql.NVarChar, reportId)
    .query(`
      select top 1 input_json
      from reports
      where id = @id
    `);

  const row = result.recordset[0];
  if (!row?.input_json) return null;
  return JSON.parse(row.input_json) as CreateReportInput;
}

type ListRow = {
  id: string;
  status: string;
  summary: string;
  created_at: Date;
  updated_at: Date;
  ai_draft_json: string | null;
  user_draft_json: string | null;
};

function rowToPartialReport(row: ListRow): Report {
  const draftJson = row.user_draft_json ?? row.ai_draft_json;
  if (draftJson) {
    const draft = JSON.parse(draftJson) as Report;
    draft.id = row.id;
    draft.status = row.status as Report["status"];
    return draft;
  }
  const isoNow = new Date().toISOString();
  const createdAt = row.created_at instanceof Date ? row.created_at.toISOString() : isoNow;
  const updatedAt = row.updated_at instanceof Date ? row.updated_at.toISOString() : isoNow;
  const emptyVictim: Report["victim"] = { hasVictim: false, category: "なし", damageLevel: "なし" };
  const emptyFiveW: Report["fiveWTwoH"] = { when: "", where: "", who: "", what: "", why: "", how: "", howMuch: "" };
  return {
    id: row.id,
    status: row.status as Report["status"],
    summary: row.summary ?? "",
    title: "事故報告書",
    occurredAt: createdAt,
    location: "",
    reportedAt: createdAt,
    reporter: "担当者",
    department: "",
    victim: emptyVictim,
    fiveWTwoH: emptyFiveW,
    cause: "",
    treatment: "",
    preventiveAction: "",
    body: "",
    photos: [],
    originalAiOutput: { victim: emptyVictim, fiveWTwoH: emptyFiveW, cause: "", treatment: "", preventiveAction: "", body: "", photos: [] },
    feedbacks: [],
    createdAt,
    updatedAt,
  };
}

export async function getAllReports(): Promise<Report[]> {
  const pool = await getDbPool();

  const result = await pool
    .request()
    .query<ListRow>(`
      select id, status, summary, created_at, updated_at,
             ai_draft_json, user_draft_json
      from reports
      order by created_at desc
    `);

  return result.recordset.map(rowToPartialReport);
}
