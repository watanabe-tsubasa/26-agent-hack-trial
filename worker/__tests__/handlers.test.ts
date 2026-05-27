import test from "node:test";
import assert from "node:assert/strict";
import { handlePromptImprovementMessage, handleReportMessage } from "../handlers";

test("handleReportMessage skips invalid message", async () => {
  let called = false;
  const deps = {
    parseReportMsg: () => null,
    parsePromptMsg: () => null,
    updateStatus: async () => { called = true; },
  } as unknown as NonNullable<Parameters<typeof handleReportMessage>[1]>;
  await handleReportMessage({}, deps);
  assert.equal(called, false);
});

test("handlePromptImprovementMessage marks superseded when active mismatch", async () => {
  const calls: string[] = [];
  const deps = {
    parseReportMsg: () => null,
    parsePromptMsg: () => ({ runId: "r1", locationKey: "l1" }),
    getActiveRun: async () => ({ id: "r2" }),
    markSuperseded: async (_id: string, reason?: string) => {
      calls.push(reason ?? "");
    },
  } as unknown as NonNullable<Parameters<typeof handlePromptImprovementMessage>[1]>;
  await handlePromptImprovementMessage({ runId: "r1", locationKey: "l1" }, deps);
  assert.match(calls[0], /newer active run exists/);
});
