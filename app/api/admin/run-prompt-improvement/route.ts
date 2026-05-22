import { NextRequest } from "next/server";
import { getDbPool, sql } from "@/lib/db";
import { buildCorrectionSummary, generateLocationPromptOverride } from "@/lib/generate-location-prompt-override";
import { createDraftLocationPromptOverride } from "@/lib/location-prompt-override-repository";
import {
  createPromptImprovementRun,
  completePromptImprovementRun,
  failPromptImprovementRun,
} from "@/lib/prompt-improvement-run-repository";
import type { JsonDiffItem } from "@/lib/json-diff";

async function getCorrectionsForLocation(locationKey: string) {
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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const locationKey = body?.locationKey as string | undefined;
  if (!locationKey) {
    return Response.json({ error: "locationKey is required" }, { status: 400 });
  }

  const runId = await createPromptImprovementRun({ locationKey });

  try {
    const diffSets = await getCorrectionsForLocation(locationKey);
    if (diffSets.length === 0) {
      await failPromptImprovementRun({ id: runId, errorMessage: "No corrections found for this location" });
      return Response.json({ error: "No corrections found for this location" }, { status: 422 });
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

    return Response.json({
      runId,
      overrideId,
      locationKey,
      inputCorrectionCount: diffSets.length,
      proposal,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failPromptImprovementRun({ id: runId, errorMessage: message });
    return Response.json({ error: message }, { status: 500 });
  }
}
