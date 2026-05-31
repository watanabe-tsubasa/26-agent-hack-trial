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
import type { KnowledgeImprovementStepKey } from "./knowledge-improvement-steps";
import type { AgentEventState } from "./agent-event-log";

export type KnowledgeStepReporter = (event: {
  stepKey: KnowledgeImprovementStepKey;
  state: AgentEventState;
  metadata?: Record<string, unknown>;
  errorMessage?: string;
}) => void | Promise<void>;

export async function getCorrectionsForLocation(locationKey: string): Promise<CorrectionDiffSet[]> {
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

type PromptImprovementDeps = {
  getCorrections: (locationKey: string) => Promise<CorrectionDiffSet[]>;
  buildSummary: typeof buildCorrectionSummary;
  generateOverride: typeof generateLocationPromptOverride;
  createDraft: typeof createDraftLocationPromptOverride;
  archiveOlderDrafts: typeof archiveOlderDraftLocationPromptOverrides;
  completeRun: typeof completePromptImprovementRun;
  failRun: typeof failPromptImprovementRun;
};

const defaultDeps: PromptImprovementDeps = {
  getCorrections: getCorrectionsForLocation,
  buildSummary: buildCorrectionSummary,
  generateOverride: generateLocationPromptOverride,
  createDraft: createDraftLocationPromptOverride,
  archiveOlderDrafts: archiveOlderDraftLocationPromptOverrides,
  completeRun: completePromptImprovementRun,
  failRun: failPromptImprovementRun,
};

export async function runPromptImprovementJob(
  {
    runId,
    locationKey,
  }: {
    runId: string;
    locationKey: string;
  },
  deps: PromptImprovementDeps = defaultDeps,
  onStep?: KnowledgeStepReporter
): Promise<void> {
  let currentStep: KnowledgeImprovementStepKey = "collect_corrections";
  try {
    await onStep?.({ stepKey: "collect_corrections", state: "started" });
    const diffSets = await deps.getCorrections(locationKey);
    await onStep?.({
      stepKey: "collect_corrections",
      state: "completed",
      metadata: { correctionCount: diffSets.length },
    });

    if (diffSets.length === 0) {
      await deps.failRun({
        id: runId,
        errorMessage: "No corrections found for this location",
      });
      return;
    }

    currentStep = "analyze_patterns";
    await onStep?.({ stepKey: "analyze_patterns", state: "started" });
    const summary = deps.buildSummary(locationKey, diffSets);
    await onStep?.({ stepKey: "analyze_patterns", state: "completed" });

    currentStep = "generate_knowledge";
    await onStep?.({ stepKey: "generate_knowledge", state: "started" });
    const proposal = await deps.generateOverride(summary);
    await onStep?.({ stepKey: "generate_knowledge", state: "completed" });

    const analysisJson = JSON.stringify({
      summary: proposal.summary,
      facilityKnowledgeCandidates: proposal.facilityKnowledgeCandidates,
      ignoredStyleCorrections: proposal.ignoredStyleCorrections,
      riskNotes: proposal.riskNotes,
    });

    currentStep = "prepare_review";
    await onStep?.({ stepKey: "prepare_review", state: "started" });
    const overrideId = await deps.createDraft({
      locationKey,
      title: proposal.title,
      overrideText: proposal.overrideText,
      source: "ai_proposed",
      analysisJson,
    });

    const archivedCount = await deps.archiveOlderDrafts({
      locationKey,
      keepId: overrideId,
    });
    if (archivedCount > 0) {
      console.log(
        `[prompt-improvement:${runId}] archived ${archivedCount} older ai_proposed draft(s)`
      );
    }

    await deps.completeRun({
      id: runId,
      inputCorrectionCount: diffSets.length,
      summaryJson: JSON.stringify(summary),
      proposedOverrideId: overrideId,
    });
    await onStep?.({ stepKey: "prepare_review", state: "completed" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await onStep?.({ stepKey: currentStep, state: "failed", errorMessage: message });
    await deps.failRun({ id: runId, errorMessage: message });
    throw err;
  }
}
