import { randomUUID } from "crypto";
import { getDbPool, sql } from "./db";

export type LocationPromptOverride = {
  id: string;
  locationKey: string;
  title: string;
  overrideText: string;
  source: "manual" | "ai_proposed";
  status: "draft" | "active" | "archived";
  analysisJson: string | null;
  createdAt: string;
  approvedAt: string | null;
};

type OverrideRow = {
  id: string;
  location_key: string;
  title: string;
  override_text: string;
  source: string;
  status: string;
  analysis_json: string | null;
  created_at: Date;
  approved_at: Date | null;
};

function rowToOverride(row: OverrideRow): LocationPromptOverride {
  return {
    id: row.id,
    locationKey: row.location_key,
    title: row.title,
    overrideText: row.override_text,
    source: row.source as LocationPromptOverride["source"],
    status: row.status as LocationPromptOverride["status"],
    analysisJson: row.analysis_json,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    approvedAt: row.approved_at instanceof Date ? row.approved_at.toISOString() : (row.approved_at ? String(row.approved_at) : null),
  };
}

export async function getActiveLocationPromptOverride(
  locationKey: string
): Promise<LocationPromptOverride | null> {
  const pool = await getDbPool();

  const result = await pool
    .request()
    .input("locationKey", sql.NVarChar, locationKey)
    .query<OverrideRow>(`
      select top 1 id, location_key, title, override_text, source, status, analysis_json, created_at, approved_at
      from location_prompt_overrides
      where location_key = @locationKey and status = 'active'
      order by approved_at desc
    `);

  const row = result.recordset[0];
  return row ? rowToOverride(row) : null;
}

export async function createDraftLocationPromptOverride({
  locationKey,
  title,
  overrideText,
  source,
  analysisJson,
}: {
  locationKey: string;
  title: string;
  overrideText: string;
  source: "manual" | "ai_proposed";
  analysisJson: string | null;
}): Promise<string> {
  const pool = await getDbPool();
  const id = `override_${randomUUID()}`;

  await pool
    .request()
    .input("id", sql.NVarChar, id)
    .input("locationKey", sql.NVarChar, locationKey)
    .input("title", sql.NVarChar, title)
    .input("overrideText", sql.NVarChar, overrideText)
    .input("source", sql.NVarChar, source)
    .input("analysisJson", sql.NVarChar, analysisJson)
    .query(`
      insert into location_prompt_overrides
        (id, location_key, title, override_text, source, status, analysis_json)
      values
        (@id, @locationKey, @title, @overrideText, @source, 'draft', @analysisJson)
    `);

  return id;
}

export async function approveLocationPromptOverride(id: string): Promise<void> {
  const pool = await getDbPool();

  const result = await pool
    .request()
    .input("id", sql.NVarChar, id)
    .query(`select top 1 location_key from location_prompt_overrides where id = @id`);

  const locationKey = result.recordset[0]?.location_key;
  if (!locationKey) throw new Error("Override not found");

  await pool
    .request()
    .input("locationKey", sql.NVarChar, locationKey)
    .query(`
      update location_prompt_overrides
      set status = 'archived'
      where location_key = @locationKey and status = 'active'
    `);

  await pool
    .request()
    .input("id", sql.NVarChar, id)
    .query(`
      update location_prompt_overrides
      set status = 'active', approved_at = sysutcdatetime()
      where id = @id
    `);
}

export async function listLocationPromptOverrides(
  locationKey?: string
): Promise<LocationPromptOverride[]> {
  const pool = await getDbPool();

  const req = pool.request();
  let query = `
    select id, location_key, title, override_text, source, status, analysis_json, created_at, approved_at
    from location_prompt_overrides
  `;
  if (locationKey) {
    req.input("locationKey", sql.NVarChar, locationKey);
    query += ` where location_key = @locationKey`;
  }
  query += ` order by created_at desc`;

  const result = await req.query<OverrideRow>(query);
  return result.recordset.map(rowToOverride);
}
