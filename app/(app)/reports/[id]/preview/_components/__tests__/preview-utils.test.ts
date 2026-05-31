import test from "node:test";
import assert from "node:assert/strict";
import { CIRCLE_NUMS, formatDate, resolvePreviewStatus } from "../preview-utils";

test("CIRCLE_NUMS has 8 markers", () => {
  assert.equal(CIRCLE_NUMS.length, 8);
  assert.equal(CIRCLE_NUMS[0], "①");
  assert.equal(CIRCLE_NUMS[7], "⑧");
});

test("formatDate returns original string when invalid", () => {
  const invalid = "invalid-date";
  assert.equal(formatDate(invalid), invalid);
});

test("formatDate formats valid date", () => {
  const formatted = formatDate("2026-01-02T03:04:05.000Z");
  assert.equal(typeof formatted, "string");
  assert.notEqual(formatted, "2026-01-02T03:04:05.000Z");
});

test("resolvePreviewStatus returns confirmed only for confirmed status", () => {
  assert.equal(resolvePreviewStatus("confirmed"), "確定済");
  assert.equal(resolvePreviewStatus("review"), "ドラフト");
});
