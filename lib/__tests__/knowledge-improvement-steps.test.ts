import test from "node:test";
import assert from "node:assert/strict";
import {
  KNOWLEDGE_IMPROVEMENT_STEPS,
  deriveKnowledgeStepStates,
  deriveKnowledgeStepStatesFromEvents,
  pickKnowledgeGoodjobTone,
} from "../prompt-improvement/knowledge-improvement-steps";

test("queued: first step in_progress, rest pending", () => {
  const snaps = deriveKnowledgeStepStates("queued", 0);
  assert.equal(snaps.length, KNOWLEDGE_IMPROVEMENT_STEPS.length);
  assert.equal(snaps[0].state, "in_progress");
  for (let i = 1; i < snaps.length; i++) {
    assert.equal(snaps[i].state, "pending");
  }
});

test("running: advances by elapsed time", () => {
  const snaps = deriveKnowledgeStepStates("running", 4500); // ~2 steps done
  assert.equal(snaps[0].state, "completed");
  assert.equal(snaps[1].state, "completed");
  assert.equal(snaps[2].state, "in_progress");
  assert.equal(snaps[3].state, "pending");
});

test("running: caps at last step in_progress", () => {
  const snaps = deriveKnowledgeStepStates("running", 999_999);
  for (let i = 0; i < snaps.length - 1; i++) {
    assert.equal(snaps[i].state, "completed");
  }
  assert.equal(snaps[snaps.length - 1].state, "in_progress");
});

test("completed: all completed", () => {
  const snaps = deriveKnowledgeStepStates("completed", 0);
  snaps.forEach((s) => assert.equal(s.state, "completed"));
});

test("failed: marks current step failed", () => {
  const snaps = deriveKnowledgeStepStates("failed", 4500);
  assert.equal(snaps[0].state, "completed");
  assert.equal(snaps[1].state, "completed");
  assert.equal(snaps[2].state, "failed");
  assert.equal(snaps[3].state, "pending");
});

test("superseded/null: all pending", () => {
  const sup = deriveKnowledgeStepStates("superseded", 0);
  sup.forEach((s) => assert.equal(s.state, "pending"));
  const nul = deriveKnowledgeStepStates(null, 0);
  nul.forEach((s) => assert.equal(s.state, "pending"));
});

test("pickKnowledgeGoodjobTone: failed -> warning", () => {
  const snaps = deriveKnowledgeStepStates("failed", 0);
  assert.equal(pickKnowledgeGoodjobTone(snaps), "warning");
});

test("pickKnowledgeGoodjobTone: in_progress returns step tone", () => {
  const snaps = deriveKnowledgeStepStates("queued", 0);
  assert.equal(pickKnowledgeGoodjobTone(snaps), KNOWLEDGE_IMPROVEMENT_STEPS[0].goodjob);
});

test("pickKnowledgeGoodjobTone: all completed -> success", () => {
  const snaps = deriveKnowledgeStepStates("completed", 0);
  assert.equal(pickKnowledgeGoodjobTone(snaps), "success");
});

test("deriveKnowledgeStepStatesFromEvents: empty -> all pending", () => {
  const snaps = deriveKnowledgeStepStatesFromEvents([]);
  snaps.forEach((s) => assert.equal(s.state, "pending"));
});

test("deriveKnowledgeStepStatesFromEvents: latest event per step wins", () => {
  const snaps = deriveKnowledgeStepStatesFromEvents([
    { stepKey: "collect_corrections", state: "completed" },
    { stepKey: "analyze_patterns", state: "started" },
  ]);
  assert.equal(snaps[0].state, "completed");
  assert.equal(snaps[1].state, "in_progress");
  assert.equal(snaps[2].state, "pending");
  assert.equal(snaps[3].state, "pending");
});
