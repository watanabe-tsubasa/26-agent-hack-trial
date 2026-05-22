import { getDbPool, sql } from "./db";
import {
  buildCorrectionSummary,
  generateLocationPromptOverride,
} from "./generate-location-prompt-override";
import { createDraftLocationPromptOverride } from "./location-prompt-override-repository";
import {
  completePromptImprovementRun,
  failPromptImprovementRun,
} from "./prompt-improvement-run-repository";
import type { JsonDiffItem } from "./json-diff";

async function getCorrectionsForLocation(locationKey: string): Promise<JsonDiffItem[][]> {
  const pool = await getDbPool();

  const result = await pool
    .request()
    .input("locationKey", sql.NVarChar, locationKey)
    .query<{ diff_json: string }>(`
      select rc.diff_json
      from report_corrections rc
      join reports r on rc.report_id = r.id
      where JSON_VALUE(r.input_json, '$.facilityId') = @locationKey
      order by rc.created_at desc
    `);

  return result.recordset.map((row) => JSON.parse(row.diff_json) as JsonDiffItem[]);
}

export async function runPromptImprovementJob({
  runId,
  locationKey,
}: {
  runId: string;
  locationKey: string;
}): Promise<void> {
  try {
    const diffSets = await getCorrectionsForLocation(locationKey);

    if (diffSets.length === 0) {
      await failPromptImprovementRun({
        id: runId,
        errorMessage: "No corrections found for this location",
      });
      return;
    }

    const summary = buildCorrectionSummary(locationKey, diffSets);
    const proposal = await generateLocationPromptOverride(summary);

    const analysisJson = JSON.stringify({
      summary: proposal.summary,
      observedCorrectionPatterns: proposal.observedCorrectionPatterns,
      riskNotes: proposal.riskNotes,
    });

    const overrideId = await createDraftLocationPromptOverride({
      locationKey,
      title: proposal.title,
      overrideText: proposal.overrideText,
      source: "ai_proposed",
      analysisJson,
    });

    await completePromptImprovementRun({
      id: runId,
      inputCorrectionCount: diffSets.length,
      summaryJson: JSON.stringify(summary),
      proposedOverrideId: overrideId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failPromptImprovementRun({ id: runId, errorMessage: message });
    throw err;
  }
}
