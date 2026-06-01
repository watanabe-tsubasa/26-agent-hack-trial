import { test } from "node:test";
import assert from "node:assert/strict";
import { isReportDirty } from "../reports/dirty-check";
import type { Photo, Report } from "../types";

function makePhoto(partial: Partial<Photo>): Photo {
  return {
    id: "p1",
    imageUrl: "http://example.com/p1.jpg",
    cameraName: "cam",
    capturedAt: "2026-05-26T15:20:00+09:00",
    photoLocationName: "loc",
    ...partial,
  };
}

function makeReport(partial: Partial<Report> = {}): Report {
  const photos = partial.photos ?? [makePhoto({})];
  return {
    id: "r1",
    status: "review",
    title: "事故報告書",
    summary: "概要",
    occurredAt: "2026-05-26T15:20:36+09:00",
    location: "1階",
    reportedAt: "2026-05-26T16:00:00+09:00",
    reporter: "担当",
    department: "施設",
    victim: { hasVictim: false, category: "なし", damageLevel: "" },
    fiveWTwoH: {
      when: "",
      where: "",
      who: "",
      what: "",
      why: "",
      how: "",
      howMuch: "",
    },
    cause: "原因",
    treatment: "処置",
    preventiveAction: "防止策",
    body: "本文",
    photos,
    originalAiOutput: {
      victim: { hasVictim: false, category: "なし", damageLevel: "" },
      fiveWTwoH: {
        when: "",
        where: "",
        who: "",
        what: "",
        why: "",
        how: "",
        howMuch: "",
      },
      cause: "原因",
      treatment: "処置",
      preventiveAction: "防止策",
      body: "本文",
      photos,
    },
    feedbacks: [],
    createdAt: "2026-05-26T16:00:00+09:00",
    updatedAt: "2026-05-26T16:00:00+09:00",
    ...partial,
  };
}

test("同一内容なら dirty=false", () => {
  const a = makeReport();
  const b = makeReport();
  assert.equal(isReportDirty(a, b), false);
});

test("本文変更で dirty=true", () => {
  const a = makeReport();
  const b = makeReport({ body: "本文変更後" });
  assert.equal(isReportDirty(a, b), true);
});

test("写真 selected 変更で dirty=true", () => {
  const a = makeReport({ photos: [makePhoto({ selected: true })] });
  const b = makeReport({ photos: [makePhoto({ selected: false })] });
  assert.equal(isReportDirty(a, b), true);
});

test("写真追加で dirty=true", () => {
  const a = makeReport({ photos: [makePhoto({ id: "p1" })] });
  const b = makeReport({
    photos: [makePhoto({ id: "p1" }), makePhoto({ id: "p2" })],
  });
  assert.equal(isReportDirty(a, b), true);
});

test("selected=undefined と selected=true は同一扱い（既存互換）", () => {
  const a = makeReport({ photos: [makePhoto({ selected: undefined })] });
  const b = makeReport({ photos: [makePhoto({ selected: true })] });
  assert.equal(isReportDirty(a, b), false);
});
