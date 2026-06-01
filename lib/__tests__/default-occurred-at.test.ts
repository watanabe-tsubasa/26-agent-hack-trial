import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultOccurredAt, createInitialForm } from "../../app/_components/new-report-form-utils";

test("defaultOccurredAt: 当日10:00 (YYYY-MM-DDT10:00)", () => {
  const base = new Date(2026, 5, 1, 23, 45);
  assert.equal(defaultOccurredAt(base), "2026-06-01T10:00");
});

test("defaultOccurredAt: 1月1日もゼロ埋め", () => {
  const base = new Date(2026, 0, 1, 0, 0);
  assert.equal(defaultOccurredAt(base), "2026-01-01T10:00");
});

test("createInitialForm: 入力欄は空、occurredAt のみ当日10:00", () => {
  const form = createInitialForm(new Date(2026, 5, 1, 9, 30));
  assert.equal(form.summary, "");
  assert.equal(form.location, "");
  assert.equal(form.note, "");
  assert.equal(form.occurredAt, "2026-06-01T10:00");
});
