import { getDbPool } from "../db";
import type { Report } from "../types";
import { INDEXABLE_STATUSES } from "./types";

export type IndexableReportRow = {
  report: Report;
  facilityId: string | null;
  sourceUpdatedAt: string;
};

type RawRow = {
  id: string;
  status: string;
  summary: string | null;
  facility_id: string | null;
  ai_draft_json: string | null;
  user_draft_json: string | null;
  created_at: Date;
  updated_at: Date;
};

function rowToReport(row: RawRow): Report {
  const draftJson = row.user_draft_json ?? row.ai_draft_json;
  const isoNow = new Date().toISOString();
  const createdAt = row.created_at instanceof Date ? row.created_at.toISOString() : isoNow;
  const updatedAt = row.updated_at instanceof Date ? row.updated_at.toISOString() : isoNow;
  if (draftJson) {
    const draft = JSON.parse(draftJson) as Report;
    draft.id = row.id;
    draft.status = row.status as Report["status"];
    return draft;
  }
  const emptyVictim: Report["victim"] = {
    hasVictim: false,
    category: "なし",
    damageLevel: "なし",
  };
  const emptyFiveW: Report["fiveWTwoH"] = {
    when: "",
    where: "",
    who: "",
    what: "",
    why: "",
    how: "",
    howMuch: "",
  };
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
    originalAiOutput: {
      victim: emptyVictim,
      fiveWTwoH: emptyFiveW,
      cause: "",
      treatment: "",
      preventiveAction: "",
      body: "",
      photos: [],
    },
    feedbacks: [],
    createdAt,
    updatedAt,
  };
}

export async function listIndexableReports(): Promise<IndexableReportRow[]> {
  const pool = await getDbPool();
  const statusList = INDEXABLE_STATUSES.map((s) => `'${s}'`).join(",");
  const result = await pool.request().query<RawRow>(`
    select id, status, summary,
           JSON_VALUE(input_json, '$.facilityId') as facility_id,
           ai_draft_json, user_draft_json,
           created_at, updated_at
    from reports
    where status in (${statusList})
    order by updated_at desc
  `);
  return result.recordset.map((row) => ({
    report: rowToReport(row),
    facilityId: row.facility_id,
    sourceUpdatedAt: row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : new Date().toISOString(),
  }));
}

export async function getIndexableReport(reportId: string): Promise<IndexableReportRow | null> {
  const pool = await getDbPool();
  const result = await pool
    .request()
    .input("id", reportId)
    .query<RawRow>(`
      select top 1 id, status, summary,
             JSON_VALUE(input_json, '$.facilityId') as facility_id,
             ai_draft_json, user_draft_json,
             created_at, updated_at
      from reports
      where id = @id
    `);
  const row = result.recordset[0];
  if (!row) return null;
  return {
    report: rowToReport(row),
    facilityId: row.facility_id,
    sourceUpdatedAt: row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : new Date().toISOString(),
  };
}
