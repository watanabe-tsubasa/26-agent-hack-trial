import test from "node:test";
import assert from "node:assert/strict";
import { formatSavedAt, getFeedbackCountLabel, resolveDiffValue } from "../diff-utils";

test("formatSavedAt returns original value for invalid date", () => {
  assert.equal(formatSavedAt("invalid"), "invalid");
});

test("formatSavedAt formats valid date", () => {
  const result = formatSavedAt("2026-01-02T03:04:05.000Z");
  assert.equal(typeof result, "string");
  assert.notEqual(result, "2026-01-02T03:04:05.000Z");
});

test("resolveDiffValue returns fallback for empty values", () => {
  assert.equal(resolveDiffValue(""), "（空）");
  assert.equal(resolveDiffValue("abc"), "abc");
});

test("getFeedbackCountLabel returns count label", () => {
  assert.equal(getFeedbackCountLabel({ feedbacks: [] }), "0 件の修正履歴");
  const oneFeedback = [{ id: "1" }] as unknown as { id: string }[];
  assert.equal(getFeedbackCountLabel({ feedbacks: oneFeedback as never[] }), "1 件の修正履歴");
});
