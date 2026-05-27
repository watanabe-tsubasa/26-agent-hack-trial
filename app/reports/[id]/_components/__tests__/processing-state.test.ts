import test from "node:test";
import assert from "node:assert/strict";
import { isProcessingStatus, resolveStatusLabel } from "../processing-state";

test("resolveStatusLabel returns localized label for known statuses", () => {
  assert.equal(resolveStatusLabel("queued"), "AIエージェントの処理待ちです");
  assert.equal(resolveStatusLabel("failed"), "処理に失敗しました");
});

test("resolveStatusLabel falls back to original status when unknown", () => {
  assert.equal(resolveStatusLabel("custom_status"), "custom_status");
});

test("isProcessingStatus detects only in-progress statuses", () => {
  assert.equal(isProcessingStatus("queued"), true);
  assert.equal(isProcessingStatus("processing"), true);
  assert.equal(isProcessingStatus("confirmed"), false);
});
