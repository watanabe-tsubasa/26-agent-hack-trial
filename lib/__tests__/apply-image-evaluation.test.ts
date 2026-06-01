import { test } from "node:test";
import assert from "node:assert/strict";
import { applyImageEvaluationToPhotos } from "../agent/image-evaluation-ai";
import type { Photo } from "../types";
import type { ImageEvaluationOutput } from "../agent/image-evaluation-schema";

function makePhoto(id: string): Photo {
  return {
    id,
    imageUrl: `http://example.com/${id}.jpg`,
    cameraName: "cam",
    capturedAt: "2026-05-26T15:20:00+09:00",
    photoLocationName: id,
  };
}

test("shouldUseInLedger=false の候補も結果に含まれる", () => {
  const photos = [makePhoto("a"), makePhoto("b")];
  const evaluation: ImageEvaluationOutput = {
    summary: "test",
    results: [
      {
        imageId: "a",
        relevanceScore: 0.9,
        shouldUseInLedger: true,
        observedFacts: ["ok"],
        suggestedCaption: "事故直後",
        riskNotes: [],
      },
      {
        imageId: "b",
        relevanceScore: 0.2,
        shouldUseInLedger: false,
        observedFacts: [],
        suggestedCaption: "",
        riskNotes: ["関連性低"],
      },
    ],
  };

  const result = applyImageEvaluationToPhotos(photos, evaluation);
  assert.equal(result.length, 2);
  const ids = result.map((p) => p.id).sort();
  assert.deepEqual(ids, ["a", "b"]);
});

test("selected は shouldUseInLedger と一致する", () => {
  const photos = [makePhoto("a"), makePhoto("b")];
  const evaluation: ImageEvaluationOutput = {
    summary: "",
    results: [
      {
        imageId: "a",
        relevanceScore: 0.9,
        shouldUseInLedger: true,
        observedFacts: [],
        suggestedCaption: "",
        riskNotes: [],
      },
      {
        imageId: "b",
        relevanceScore: 0.1,
        shouldUseInLedger: false,
        observedFacts: [],
        suggestedCaption: "",
        riskNotes: [],
      },
    ],
  };
  const result = applyImageEvaluationToPhotos(photos, evaluation);
  const a = result.find((p) => p.id === "a")!;
  const b = result.find((p) => p.id === "b")!;
  assert.equal(a.selected, true);
  assert.equal(b.selected, false);
});

test("採用が先、未採用が後の順に並び、candidateRank が relevance降順", () => {
  const photos = [
    makePhoto("low_sel"),
    makePhoto("high_sel"),
    makePhoto("high_unsel"),
  ];
  const evaluation: ImageEvaluationOutput = {
    summary: "",
    results: [
      {
        imageId: "low_sel",
        relevanceScore: 0.4,
        shouldUseInLedger: true,
        observedFacts: [],
        suggestedCaption: "",
        riskNotes: [],
      },
      {
        imageId: "high_sel",
        relevanceScore: 0.9,
        shouldUseInLedger: true,
        observedFacts: [],
        suggestedCaption: "",
        riskNotes: [],
      },
      {
        imageId: "high_unsel",
        relevanceScore: 0.95,
        shouldUseInLedger: false,
        observedFacts: [],
        suggestedCaption: "",
        riskNotes: [],
      },
    ],
  };
  const result = applyImageEvaluationToPhotos(photos, evaluation);
  assert.deepEqual(
    result.map((p) => p.id),
    ["high_sel", "low_sel", "high_unsel"]
  );
  assert.deepEqual(
    result.map((p) => p.candidateRank),
    [1, 2, 3]
  );
});

test("評価結果にない写真は selected=true 扱い", () => {
  const photos = [makePhoto("only")];
  const evaluation: ImageEvaluationOutput = { summary: "", results: [] };
  const result = applyImageEvaluationToPhotos(photos, evaluation);
  assert.equal(result.length, 1);
  assert.equal(result[0].selected, true);
});
