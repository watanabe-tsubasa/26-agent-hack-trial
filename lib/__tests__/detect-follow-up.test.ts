import test from "node:test";
import assert from "node:assert/strict";
import { detectFollowUp } from "../report-rag/detect-follow-up";

test("detects follow-up keywords", () => {
  assert.equal(detectFollowUp("その中で神田事務所だけ教えて"), true);
  assert.equal(detectFollowUp("先ほどの事故で救助対応はありましたか？"), true);
  assert.equal(detectFollowUp("この事故の発生場所をまとめて"), true);
  assert.equal(detectFollowUp("前回の中で重傷者はいた？"), true);
  assert.equal(detectFollowUp("同じサイトで他にあった？"), true);
});

test("non follow-up queries return false", () => {
  assert.equal(detectFollowUp("天井落下の事故はありますか？"), false);
  assert.equal(detectFollowUp("転倒事故はありますか？"), false);
  assert.equal(detectFollowUp("事故報が多いサイトは？"), false);
});
