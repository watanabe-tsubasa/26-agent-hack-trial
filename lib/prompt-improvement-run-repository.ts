import { randomUUID } from "crypto";
import { getDbPool, sql } from "./db";

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
      values (@id, @locationKey, 'running')
    `);

  return id;
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
