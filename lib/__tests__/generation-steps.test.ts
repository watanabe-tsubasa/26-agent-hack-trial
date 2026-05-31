import test from "node:test";
import assert from "node:assert/strict";
import {
  GENERATION_STEPS,
  deriveStepStates,
  deriveStepStatesFromEvents,
  pickActiveGoodjobTone,
} from "../generation-steps";

test("queued: first step in_progress, rest pending", () => {
  const snaps = deriveStepStates("queued", 0);
  assert.equal(snaps.length, GENERATION_STEPS.length);
  assert.equal(snaps[0].state, "in_progress");
  for (let i = 1; i < snaps.length; i++) {
    assert.equal(snaps[i].state, "pending");
  }
});

test("generating_report: advances by elapsed time", () => {
  const snaps = deriveStepStates("generating_report", 5000);
  assert.equal(snaps[0].state, "completed");
  assert.equal(snaps[1].state, "completed");
  assert.equal(snaps[2].state, "in_progress");
  assert.equal(snaps[3].state, "pending");
});

test("generating_report: caps at last step in_progress", () => {
  const snaps = deriveStepStates("generating_report", 1_000_000);
  const last = snaps[snaps.length - 1];
  assert.equal(last.state, "in_progress");
  for (let i = 0; i < snaps.length - 1; i++) {
    assert.equal(snaps[i].state, "completed");
  }
});

test("waiting_human_review: all completed", () => {
  const snaps = deriveStepStates("waiting_human_review", 0);
  for (const s of snaps) assert.equal(s.state, "completed");
});

test("failed: marks current step failed", () => {
  const snaps = deriveStepStates("failed", 5000);
  assert.equal(snaps[2].state, "failed");
});

test("pickActiveGoodjobTone: returns warning when any step failed", () => {
  const snaps = deriveStepStates("failed", 5000);
  assert.equal(pickActiveGoodjobTone(snaps), "warning");
});

test("pickActiveGoodjobTone: returns step tone when in_progress", () => {
  const snaps = deriveStepStates("generating_report", 0);
  assert.equal(pickActiveGoodjobTone(snaps), "thinking");
});

test("pickActiveGoodjobTone: success when all completed", () => {
  const snaps = deriveStepStates("waiting_human_review", 0);
  assert.equal(pickActiveGoodjobTone(snaps), "success");
});

test("deriveStepStatesFromEvents: empty events -> all pending", () => {
  const snaps = deriveStepStatesFromEvents([]);
  snaps.forEach((s) => assert.equal(s.state, "pending"));
});

test("deriveStepStatesFromEvents: latest event per step wins", () => {
  const snaps = deriveStepStatesFromEvents([
    { stepKey: "parse_input", state: "started" },
    { stepKey: "parse_input", state: "completed" },
    { stepKey: "search_camera_frames", state: "started" },
  ]);
  assert.equal(snaps[0].state, "completed");
  assert.equal(snaps[1].state, "in_progress");
  assert.equal(snaps[2].state, "pending");
});

test("deriveStepStatesFromEvents: failed state propagates", () => {
  const snaps = deriveStepStatesFromEvents([
    { stepKey: "parse_input", state: "completed" },
    { stepKey: "generate_report", state: "failed" },
  ]);
  assert.equal(snaps[0].state, "completed");
  const generate = snaps.find((s) => s.step.key === "generate_report")!;
  assert.equal(generate.state, "failed");
});
