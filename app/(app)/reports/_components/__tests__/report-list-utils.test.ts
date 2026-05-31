import test from "node:test";
import assert from "node:assert/strict";
import {
  formatDate,
  resolveStatusColor,
  resolveStatusLabel,
} from "../report-list-utils";

test("resolveStatusLabel resolves known status and falls back unknown", () => {
  assert.equal(resolveStatusLabel("queued"), "待機中");
  assert.equal(resolveStatusLabel("unknown_status"), "unknown_status");
});

test("resolveStatusColor resolves known status and falls back unknown", () => {
  assert.match(resolveStatusColor("confirmed"), /bg-green-100/);
  assert.equal(resolveStatusColor("unknown_status"), "bg-gray-100 text-gray-600");
});

test("formatDate returns original value when invalid date string", () => {
  const invalid = "not-a-date";
  assert.equal(formatDate(invalid), invalid);
});

test("formatDate formats valid date", () => {
  const formatted = formatDate("2026-01-02T03:04:05.000Z");
  assert.equal(typeof formatted, "string");
  assert.notEqual(formatted, "2026-01-02T03:04:05.000Z");
});
