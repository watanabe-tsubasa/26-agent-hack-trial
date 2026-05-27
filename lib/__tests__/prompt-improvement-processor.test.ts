import test from "node:test";
import assert from "node:assert/strict";
import { runPromptImprovementJob } from "../prompt-improvement-processor";

test("runPromptImprovementJob marks run failed when no corrections", async () => {
  const calls: string[] = [];
  const deps: NonNullable<Parameters<typeof runPromptImprovementJob>[1]> = {
    getCorrections: async () => [],
    buildSummary: () => { throw new Error("should not be called"); },
    generateOverride: async () => { throw new Error("should not be called"); },
    createDraft: async () => "",
    archiveOlderDrafts: async () => 0,
    completeRun: async () => { calls.push("complete"); },
    failRun: async ({ errorMessage }: { errorMessage: string }) => { calls.push(errorMessage); },
  };

  await runPromptImprovementJob(
    { runId: "r1", locationKey: "store-001" },
    deps
  );

  assert.deepEqual(calls, ["No corrections found for this location"]);
});

test("runPromptImprovementJob completes run when proposal is generated", async () => {
  const calls: string[] = [];
  const deps: NonNullable<Parameters<typeof runPromptImprovementJob>[1]> = {
    getCorrections: async () => [{ reportId: "rep-1", items: [] }],
    buildSummary: () => ({ locationKey: "store-001", correctionCount: 1, frequentFields: [], examples: [] }),
    generateOverride: async () => ({
      title: "t",
      overrideText: "body",
      summary: "s",
      facilityKnowledgeCandidates: [],
      ignoredStyleCorrections: [],
      riskNotes: [],
    }),
    createDraft: async () => "ovr-1",
    archiveOlderDrafts: async () => 1,
    completeRun: async ({ proposedOverrideId }: { proposedOverrideId: string | null }) => { calls.push(`complete:${proposedOverrideId}`); },
    failRun: async ({ errorMessage }: { errorMessage: string }) => { calls.push(`fail:${errorMessage}`); },
  };

  await runPromptImprovementJob(
    { runId: "r2", locationKey: "store-001" },
    deps
  );

  assert.deepEqual(calls, ["complete:ovr-1"]);
});
