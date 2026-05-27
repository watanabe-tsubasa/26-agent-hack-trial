import test from "node:test";
import assert from "node:assert/strict";
import { handlePromptImprovementMessage, handleReportMessage } from "../handlers";

test("handleReportMessage skips invalid message", async () => {
  let called = false;
  await handleReportMessage({}, {
    parseReportMsg: () => null,
    parsePromptMsg: () => null,
    updateStatus: async () => { called = true; },
  } as any);
  assert.equal(called, false);
});

test("handlePromptImprovementMessage marks superseded when active mismatch", async () => {
  const calls: string[] = [];
  await handlePromptImprovementMessage({ runId: "r1", locationKey: "l1" }, {
    parseReportMsg: () => null,
    parsePromptMsg: () => ({ runId: "r1", locationKey: "l1" }),
    getActiveRun: async () => ({ id: "r2" }),
    markSuperseded: async (_id, reason) => calls.push(reason),
  } as any);
  assert.match(calls[0], /newer active run exists/);
});
