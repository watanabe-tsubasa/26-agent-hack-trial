import test from "node:test";
import assert from "node:assert/strict";
import { runPromptImprovementJob } from "../prompt-improvement-processor";

test("runPromptImprovementJob marks run failed when no corrections", async () => {
  const calls: string[] = [];
  await runPromptImprovementJob(
    { runId: "r1", locationKey: "store-001" },
    {
      getCorrections: async () => [],
      buildSummary: () => { throw new Error("should not be called"); },
      generateOverride: async () => { throw new Error("should not be called"); },
      createDraft: async () => "",
      archiveOlderDrafts: async () => 0,
      completeRun: async () => { calls.push("complete"); },
      failRun: async ({ errorMessage }) => { calls.push(errorMessage); },
    } as any
  );

  assert.deepEqual(calls, ["No corrections found for this location"]);
});

test("runPromptImprovementJob completes run when proposal is generated", async () => {
  const calls: string[] = [];
  await runPromptImprovementJob(
    { runId: "r2", locationKey: "store-001" },
    {
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
      completeRun: async ({ proposedOverrideId }) => { calls.push(`complete:${proposedOverrideId}`); },
      failRun: async ({ errorMessage }) => { calls.push(`fail:${errorMessage}`); },
    } as any
  );

  assert.deepEqual(calls, ["complete:ovr-1"]);
});
