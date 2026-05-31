import test from "node:test";
import assert from "node:assert/strict";
import {
  appendAgentEvent,
  buildAgentEventDoc,
  listAgentEventsByReport,
  listAgentEventsByRun,
} from "../agent-events/agent-event-log";

test("buildAgentEventDoc: report event has entityId = reportId", () => {
  const doc = buildAgentEventDoc({
    entityType: "report",
    reportId: "rep-1",
    runId: null,
    stepKey: "parse_input",
    stepLabel: "事故概要を整理",
    state: "started",
  });
  assert.ok(doc);
  assert.equal(doc.entityType, "report");
  assert.equal(doc.entityId, "rep-1");
  assert.equal(doc.reportId, "rep-1");
  assert.equal(doc.runId, null);
});

test("buildAgentEventDoc: prompt_improvement_run event has entityId = runId", () => {
  const doc = buildAgentEventDoc({
    entityType: "prompt_improvement_run",
    reportId: null,
    runId: "run-9",
    stepKey: "analyze_patterns",
    stepLabel: "傾向を整理",
    state: "completed",
  });
  assert.ok(doc);
  assert.equal(doc.entityType, "prompt_improvement_run");
  assert.equal(doc.entityId, "run-9");
  assert.equal(doc.runId, "run-9");
  assert.equal(doc.reportId, null);
});

test("buildAgentEventDoc: returns null when matching id missing", () => {
  const reportMissing = buildAgentEventDoc({
    entityType: "report",
    reportId: null,
    runId: "run-1",
    stepKey: "parse_input",
    stepLabel: "x",
    state: "started",
  });
  assert.equal(reportMissing, null);

  const runMissing = buildAgentEventDoc({
    entityType: "prompt_improvement_run",
    reportId: "rep-1",
    runId: null,
    stepKey: "analyze_patterns",
    stepLabel: "x",
    state: "started",
  });
  assert.equal(runMissing, null);
});

test("buildAgentEventDoc: occurredAt defaults to now if omitted", () => {
  const before = Date.now();
  const doc = buildAgentEventDoc({
    entityType: "report",
    reportId: "rep-2",
    runId: null,
    stepKey: "parse_input",
    stepLabel: "x",
    state: "started",
  });
  const after = Date.now();
  assert.ok(doc);
  const at = new Date(doc.occurredAt).getTime();
  assert.ok(at >= before && at <= after);
});

test("appendAgentEvent: no-op when Cosmos env unset (no throw)", async () => {
  delete process.env.COSMOS_ENDPOINT;
  delete process.env.COSMOS_KEY;
  delete process.env.COSMOS_CONNECTION_STRING;
  await assert.doesNotReject(() =>
    appendAgentEvent({
      entityType: "report",
      reportId: "rep-x",
      runId: null,
      stepKey: "parse_input",
      stepLabel: "x",
      state: "started",
    })
  );
});

test("listAgentEventsByReport: returns [] when Cosmos disabled", async () => {
  delete process.env.COSMOS_ENDPOINT;
  delete process.env.COSMOS_KEY;
  delete process.env.COSMOS_CONNECTION_STRING;
  const events = await listAgentEventsByReport("rep-x");
  assert.deepEqual(events, []);
});

test("listAgentEventsByRun: returns [] when Cosmos disabled", async () => {
  delete process.env.COSMOS_ENDPOINT;
  delete process.env.COSMOS_KEY;
  delete process.env.COSMOS_CONNECTION_STRING;
  const events = await listAgentEventsByRun("run-x");
  assert.deepEqual(events, []);
});
