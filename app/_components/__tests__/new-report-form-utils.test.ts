import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCreateReportPayload,
  DEFAULT_FORM,
  validateRequired,
} from "../new-report-form-utils";

test("validateRequired returns error when required fields are missing", () => {
  assert.equal(
    validateRequired({ ...DEFAULT_FORM, summary: "" }),
    "事故概要・発生日時・発生場所は必須です。"
  );
});

test("validateRequired returns null when required fields exist", () => {
  assert.equal(validateRequired(DEFAULT_FORM), null);
});

test("buildCreateReportPayload converts occurredAt into ISO string", () => {
  const payload = buildCreateReportPayload(DEFAULT_FORM);
  assert.match(payload.occurredAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.notEqual(payload.occurredAt, DEFAULT_FORM.occurredAt);
});
