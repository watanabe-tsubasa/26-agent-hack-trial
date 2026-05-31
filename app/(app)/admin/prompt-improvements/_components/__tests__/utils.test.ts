import test from "node:test";
import assert from "node:assert/strict";
import { formatDateTime, isInFlight, parseAnalysis, selectOverrideGroups } from "../utils";

test("formatDateTime handles null and invalid values", () => {
  assert.equal(formatDateTime(null), "-");
  assert.equal(formatDateTime("invalid"), "invalid");
});

test("parseAnalysis parses valid json and returns null for invalid", () => {
  assert.deepEqual(parseAnalysis('{"summary":"ok"}'), { summary: "ok" });
  assert.equal(parseAnalysis("{"), null);
});

test("isInFlight detects queued/running", () => {
  assert.equal(isInFlight(null), false);
  assert.equal(isInFlight({ status: "queued" } as any), true);
  assert.equal(isInFlight({ status: "running" } as any), true);
  assert.equal(isInFlight({ status: "completed" } as any), false);
});

test("selectOverrideGroups returns active/latestDraft/archived", () => {
  const { active, latestDraft, archived } = selectOverrideGroups([
    { id: "1", status: "draft", createdAt: "2026-01-01", locationKey: "l", title: "a", overrideText: "", source: "manual", analysisJson: null, approvedAt: null },
    { id: "2", status: "active", createdAt: "2026-01-02", locationKey: "l", title: "b", overrideText: "", source: "manual", analysisJson: null, approvedAt: null },
    { id: "3", status: "draft", createdAt: "2026-01-03", locationKey: "l", title: "c", overrideText: "", source: "manual", analysisJson: null, approvedAt: null },
    { id: "4", status: "archived", createdAt: "2025-12-01", locationKey: "l", title: "d", overrideText: "", source: "manual", analysisJson: null, approvedAt: null },
  ] as any);
  assert.equal(active?.id, "2");
  assert.equal(latestDraft?.id, "3");
  assert.equal(archived.length, 1);
});
