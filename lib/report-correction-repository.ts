import { randomUUID } from "crypto";
import { getDbPool, sql } from "./db";
import type { JsonDiffItem } from "./json-diff";

export type ReportCorrectionRow = {
  id: string;
  reportId: string;
  diffItems: JsonDiffItem[];
  createdAt: string;
};

export async function getCorrectionsForReport(reportId: string): Promise<ReportCorrectionRow[]> {
  const pool = await getDbPool();

  const result = await pool
    .request()
    .input("reportId", sql.NVarChar, reportId)
    .query<{ id: string; report_id: string; diff_json: string; created_at: Date }>(`
      select id, report_id, diff_json, created_at
      from report_corrections
      where report_id = @reportId
      order by created_at desc
    `);

  return result.recordset.map((row) => ({
    id: row.id,
    reportId: row.report_id,
    diffItems: JSON.parse(row.diff_json) as JsonDiffItem[],
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }));
}

export async function saveReportCorrection({
  reportId,
  aiDraftJson,
  userDraftJson,
  diffItems,
}: {
  reportId: string;
  aiDraftJson: string;
  userDraftJson: string;
  diffItems: JsonDiffItem[];
}): Promise<void> {
  const pool = await getDbPool();
  const id = `correction_${randomUUID()}`;

  await pool
    .request()
    .input("id", sql.NVarChar, id)
    .input("reportId", sql.NVarChar, reportId)
    .input("aiDraftJson", sql.NVarChar, aiDraftJson)
    .input("userDraftJson", sql.NVarChar, userDraftJson)
    .input("diffJson", sql.NVarChar, JSON.stringify(diffItems))
    .query(`
      insert into report_corrections (id, report_id, ai_draft_json, user_draft_json, diff_json)
      values (@id, @reportId, @aiDraftJson, @userDraftJson, @diffJson)
    `);
}
