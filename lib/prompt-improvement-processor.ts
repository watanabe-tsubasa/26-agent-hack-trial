import { getDbPool, sql } from "./db";
import {
  buildCorrectionSummary,
  generateLocationPromptOverride,
  type CorrectionDiffSet,
} from "./generate-location-prompt-override";
import {
  archiveOlderDraftLocationPromptOverrides,
  createDraftLocationPromptOverride,
} from "./location-prompt-override-repository";
import {
  completePromptImprovementRun,
  failPromptImprovementRun,
} from "./prompt-improvement-run-repository";
import type { JsonDiffItem } from "./json-diff";

async function getCorrectionsForLocation(locationKey: string): Promise<CorrectionDiffSet[]> {
  const pool = await getDbPool();

  const result = await pool
    .request()
    .input("locationKey", sql.NVarChar, locationKey)
    .query<{ report_id: string; diff_json: string }>(`
      select rc.report_id, rc.diff_json
      from report_corrections rc
      join reports r on rc.report_id = r.id
      where JSON_VALUE(r.input_json, '$.facilityId') = @locationKey
      order by rc.created_at desc
    `);

  return result.recordset.map((row) => ({
    reportId: row.report_id,
    items: JSON.parse(row.diff_json) as JsonDiffItem[],
  }));
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
      facilityKnowledgeCandidates: proposal.facilityKnowledgeCandidates,
      ignoredStyleCorrections: proposal.ignoredStyleCorrections,
      riskNotes: proposal.riskNotes,
    });

    const overrideId = await createDraftLocationPromptOverride({
      locationKey,
      title: proposal.title,
      overrideText: proposal.overrideText,
      source: "ai_proposed",
      analysisJson,
    });

    const archivedCount = await archiveOlderDraftLocationPromptOverrides({
      locationKey,
      keepId: overrideId,
    });
    if (archivedCount > 0) {
      console.log(
        `[prompt-improvement:${runId}] archived ${archivedCount} older ai_proposed draft(s)`
      );
    }

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
