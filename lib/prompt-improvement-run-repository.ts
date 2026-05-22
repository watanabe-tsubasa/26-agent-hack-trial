import { randomUUID } from "crypto";
import { getDbPool, sql } from "./db";

export type PromptImprovementRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "superseded";

export type PromptImprovementRun = {
  id: string;
  locationKey: string;
  status: PromptImprovementRunStatus;
  inputCorrectionCount: number | null;
  summaryJson: string | null;
  proposedOverrideId: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

type Row = {
  id: string;
  location_key: string;
  status: PromptImprovementRunStatus;
  input_correction_count: number | null;
  summary_json: string | null;
  proposed_override_id: string | null;
  error_message: string | null;
  created_at: Date;
  completed_at: Date | null;
};

function rowToRun(row: Row): PromptImprovementRun {
  return {
    id: row.id,
    locationKey: row.location_key,
    status: row.status,
    inputCorrectionCount: row.input_correction_count,
    summaryJson: row.summary_json,
    proposedOverrideId: row.proposed_override_id,
    errorMessage: row.error_message,
    createdAt: row.created_at.toISOString(),
    completedAt: row.completed_at ? row.completed_at.toISOString() : null,
  };
}

export async function createPromptImprovementRun({
  locationKey,
}: {
  locationKey: string;
}): Promise<string> {
  const pool = await getDbPool();
  const id = `pir_${randomUUID()}`;

  await pool
    .request()
    .input("id", sql.NVarChar, id)
    .input("locationKey", sql.NVarChar, locationKey)
    .query(`
      insert into prompt_improvement_runs (id, location_key, status)
      values (@id, @locationKey, 'queued')
    `);

  return id;
}

export type CreateIfNotExistsResult = {
  runId: string;
  alreadyRunning: boolean;
};

export async function createQueuedPromptImprovementRunIfNotExists(
  locationKey: string
): Promise<CreateIfNotExistsResult> {
  const pool = await getDbPool();
  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

  try {
    const existing = await new sql.Request(tx)
      .input("locationKey", sql.NVarChar, locationKey)
      .query<{ id: string }>(`
        select top 1 id
        from prompt_improvement_runs with (updlock, holdlock)
        where location_key = @locationKey
          and status in ('queued', 'running')
        order by created_at desc
      `);

    if (existing.recordset.length > 0) {
      await tx.commit();
      return { runId: existing.recordset[0].id, alreadyRunning: true };
    }

    const id = `pir_${randomUUID()}`;
    await new sql.Request(tx)
      .input("id", sql.NVarChar, id)
      .input("locationKey", sql.NVarChar, locationKey)
      .query(`
        insert into prompt_improvement_runs (id, location_key, status)
        values (@id, @locationKey, 'queued')
      `);

    await tx.commit();
    return { runId: id, alreadyRunning: false };
  } catch (err) {
    await tx.rollback().catch(() => undefined);
    throw err;
  }
}

export async function getActivePromptImprovementRun(
  locationKey: string
): Promise<PromptImprovementRun | null> {
  const pool = await getDbPool();
  const result = await pool
    .request()
    .input("locationKey", sql.NVarChar, locationKey)
    .query<Row>(`
      select top 1 id, location_key, status, input_correction_count, summary_json,
             proposed_override_id, error_message, created_at, completed_at
      from prompt_improvement_runs
      where location_key = @locationKey
        and status in ('queued', 'running')
      order by created_at desc
    `);
  if (result.recordset.length === 0) return null;
  return rowToRun(result.recordset[0]);
}

export async function getLatestPromptImprovementRun(
  locationKey: string
): Promise<PromptImprovementRun | null> {
  const pool = await getDbPool();
  const result = await pool
    .request()
    .input("locationKey", sql.NVarChar, locationKey)
    .query<Row>(`
      select top 1 id, location_key, status, input_correction_count, summary_json,
             proposed_override_id, error_message, created_at, completed_at
      from prompt_improvement_runs
      where location_key = @locationKey
      order by created_at desc
    `);
  if (result.recordset.length === 0) return null;
  return rowToRun(result.recordset[0]);
}

export async function markPromptImprovementRunSuperseded(
  id: string,
  reason?: string
): Promise<void> {
  const pool = await getDbPool();
  await pool
    .request()
    .input("id", sql.NVarChar, id)
    .input("errorMessage", sql.NVarChar, reason ?? null)
    .query(`
      update prompt_improvement_runs
      set status = 'superseded',
          error_message = @errorMessage,
          completed_at = sysutcdatetime()
      where id = @id
    `);
}

export async function markPromptImprovementRunRunning(id: string): Promise<void> {
  const pool = await getDbPool();
  await pool
    .request()
    .input("id", sql.NVarChar, id)
    .query(`
      update prompt_improvement_runs
      set status = 'running'
      where id = @id
    `);
}

export async function completePromptImprovementRun({
  id,
  inputCorrectionCount,
  summaryJson,
  proposedOverrideId,
}: {
  id: string;
  inputCorrectionCount: number;
  summaryJson: string;
  proposedOverrideId: string;
}): Promise<void> {
  const pool = await getDbPool();

  await pool
    .request()
    .input("id", sql.NVarChar, id)
    .input("inputCorrectionCount", sql.Int, inputCorrectionCount)
    .input("summaryJson", sql.NVarChar, summaryJson)
    .input("proposedOverrideId", sql.NVarChar, proposedOverrideId)
    .query(`
      update prompt_improvement_runs
      set status = 'completed',
          input_correction_count = @inputCorrectionCount,
          summary_json = @summaryJson,
          proposed_override_id = @proposedOverrideId,
          completed_at = sysutcdatetime()
      where id = @id
    `);
}

export async function failPromptImprovementRun({
  id,
  errorMessage,
}: {
  id: string;
  errorMessage: string;
}): Promise<void> {
  const pool = await getDbPool();

  await pool
    .request()
    .input("id", sql.NVarChar, id)
    .input("errorMessage", sql.NVarChar, errorMessage)
    .query(`
      update prompt_improvement_runs
      set status = 'failed',
          error_message = @errorMessage,
          completed_at = sysutcdatetime()
      where id = @id
    `);
}

export async function getPromptImprovementRun(
  id: string
): Promise<PromptImprovementRun | null> {
  const pool = await getDbPool();

  const result = await pool
    .request()
    .input("id", sql.NVarChar, id)
    .query<Row>(`
      select id, location_key, status, input_correction_count, summary_json,
             proposed_override_id, error_message, created_at, completed_at
      from prompt_improvement_runs
      where id = @id
    `);

  if (result.recordset.length === 0) return null;
  return rowToRun(result.recordset[0]);
}
