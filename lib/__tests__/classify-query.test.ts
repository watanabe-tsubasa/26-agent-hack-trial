import test from "node:test";
import assert from "node:assert/strict";
import { classifyAdminRagQuery } from "../report-rag/classify-query";

test("aggregate keywords return aggregate", () => {
  assert.equal(classifyAdminRagQuery("事故報が多いサイトは？"), "aggregate");
  assert.equal(classifyAdminRagQuery("転倒事故は何件ありますか"), "aggregate");
  assert.equal(classifyAdminRagQuery("サイト別に教えてください"), "aggregate");
});

test("non-aggregate queries return search", () => {
  assert.equal(classifyAdminRagQuery("天井落下に関係する事故はある？"), "search");
  assert.equal(classifyAdminRagQuery("救助対応が必要だった事例は？"), "search");
});
