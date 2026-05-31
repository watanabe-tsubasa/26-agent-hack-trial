import test from "node:test";
import assert from "node:assert/strict";
import { __test__ } from "../report-rag/answer";

const { toHistoryItem, buildInputItems } = __test__;

test("toHistoryItem: user role preserved with string content", () => {
  const item = toHistoryItem({ role: "user", content: "hi" });
  assert.equal(item.role, "user");
  assert.equal(item.content, "hi");
});

test("toHistoryItem: assistant role preserved with string content (avoids input_text/output_text mismatch)", () => {
  const item = toHistoryItem({ role: "assistant", content: "hello" });
  assert.equal(item.role, "assistant");
  assert.equal(item.content, "hello");
});

test("buildInputItems: appends current user prompt after history", () => {
  const items = buildInputItems({
    mode: "search",
    message: "今回の質問",
    sources: [],
    history: [
      { role: "user", content: "前の質問" },
      { role: "assistant", content: "前の回答" },
    ],
  });
  assert.equal(items.length, 3);
  assert.equal(items[0].role, "user");
  assert.equal(items[0].content, "前の質問");
  assert.equal(items[1].role, "assistant");
  assert.equal(items[1].content, "前の回答");
  assert.equal(items[2].role, "user");
  assert.match(items[2].content, /今回の質問/);
});

test("buildInputItems: caps history to HISTORY_LIMIT (6)", () => {
  const longHistory = Array.from({ length: 10 }, (_, i) => ({
    role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
    content: `msg-${i}`,
  }));
  const items = buildInputItems({
    mode: "search",
    message: "q",
    sources: [],
    history: longHistory,
  });
  // 6 history items + 1 current user prompt
  assert.equal(items.length, 7);
  // First retained history item should be msg-4 (last 6)
  assert.equal(items[0].content, "msg-4");
});

test("buildInputItems: no string content is array-shaped (regression: no input_text wrapping)", () => {
  const items = buildInputItems({
    mode: "search",
    message: "x",
    sources: [],
    history: [{ role: "assistant", content: "y" }],
  });
  for (const item of items) {
    assert.equal(typeof item.content, "string");
  }
});
