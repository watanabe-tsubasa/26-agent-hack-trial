import { test } from "node:test";
import assert from "node:assert/strict";
import { detectScenarioTags } from "../agent/camera-search";
import type { CreateReportInput } from "../types";

function makeInput(partial: Partial<CreateReportInput>): CreateReportInput {
  return {
    summary: "",
    occurredAt: "2026-05-26T15:20:36+09:00",
    location: "",
    hasVictim: false,
    recoveryStatus: "",
    amountImpact: "",
    ...partial,
  };
}

test("天井ボード落下 → ceiling", () => {
  const tags = detectScenarioTags(
    makeInput({ summary: "天井ボードが落下した", location: "1階共用通路" })
  );
  assert.deepEqual(tags, ["ceiling"]);
});

test("エスカレーター事故 → escalator", () => {
  const tags = detectScenarioTags(
    makeInput({ summary: "エスカレーターで転倒", location: "2階" })
  );
  assert.ok(tags.includes("escalator"));
  assert.ok(tags.includes("fall"));
});

test("転倒・救助 → fall + rescue", () => {
  const tags = detectScenarioTags(
    makeInput({
      summary: "従業員が転倒し起き上がれない状態で救助を要した",
      location: "事務所",
    })
  );
  assert.ok(tags.includes("fall"));
  assert.ok(tags.includes("rescue"));
});

test("該当キーワードなし → 空配列", () => {
  const tags = detectScenarioTags(
    makeInput({ summary: "雑談", location: "休憩室" })
  );
  assert.deepEqual(tags, []);
});

test("ガラス破損 → glass-damage", () => {
  const tags = detectScenarioTags(
    makeInput({ summary: "ショーケースのガラスが破損", location: "食品売場" })
  );
  assert.ok(tags.includes("glass-damage"));
});
