import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReportSearchDocument,
  buildReportSearchText,
} from "../report-rag/build-report-document";
import type { Report } from "../types";
import type { DemoSite } from "../auth/demo-sites";

const baseReport: Report = {
  id: "rep-1",
  status: "confirmed",
  title: "天井ボード落下",
  summary: "3階廊下で天井ボードが落下",
  occurredAt: "2026-05-28T01:00:00Z",
  location: "本館3階南側廊下",
  reportedAt: "2026-05-28T02:00:00Z",
  reporter: "担当者",
  department: "管理",
  victim: { hasVictim: false, category: "なし", damageLevel: "なし" },
  fiveWTwoH: {
    when: "2026-05-28 10:00",
    where: "3階廊下",
    who: "巡回担当",
    what: "天井ボードが落下",
    why: "経年劣化",
    how: "巡回中に発見",
    howMuch: "落下面積 約1m2",
  },
  cause: "経年劣化による接着不良",
  treatment: "落下物撤去",
  preventiveAction: "天井点検実施",
  body: "本館3階南側廊下を巡回中に天井ボードが落下していた。",
  photos: [
    {
      id: "p1",
      imageUrl: "/x",
      cameraName: "cam",
      capturedAt: "2026-05-28T01:00:00Z",
      photoLocationName: "3階廊下",
    },
  ],
  originalAiOutput: {
    victim: { hasVictim: false, category: "なし", damageLevel: "なし" },
    fiveWTwoH: { when: "", where: "", who: "", what: "", why: "", how: "", howMuch: "" },
    cause: "",
    treatment: "",
    preventiveAction: "",
    body: "",
    photos: [],
  },
  feedbacks: [
    {
      id: "f1",
      reportId: "rep-1",
      fieldName: "cause",
      before: "x",
      after: "y",
      diffSummary: "x→y",
      savedAt: "2026-05-28T03:00:00Z",
    },
  ],
  createdAt: "2026-05-28T02:00:00Z",
  updatedAt: "2026-05-28T03:00:00Z",
};

const site: DemoSite = {
  siteKey: "aeon-mall-kanda",
  facilityId: "aeon-mall-kanda",
  locationKey: "aeon-mall-kanda",
  name: "イオンモール神田サイト",
  description: "x",
  mediaMode: "sample_scenes",
};

test("buildReportSearchText: includes title, 5W2H, cause", () => {
  const text = buildReportSearchText(baseReport);
  assert.match(text, /タイトル: 天井ボード落下/);
  assert.match(text, /いつ: 2026-05-28 10:00/);
  assert.match(text, /原因: 経年劣化/);
  assert.match(text, /本文: /);
});

test("buildReportSearchDocument: maps fields and extracts incident types", () => {
  const text = buildReportSearchText(baseReport);
  const doc = buildReportSearchDocument({
    report: baseReport,
    site,
    embedding: [0.1, 0.2, 0.3],
    text,
    indexedAt: "2026-05-28T05:00:00Z",
    sourceUpdatedAt: baseReport.updatedAt,
  });
  assert.equal(doc.id, "report_rep-1_summary");
  assert.equal(doc.facilityId, "aeon-mall-kanda");
  assert.equal(doc.siteName, "イオンモール神田サイト");
  assert.equal(doc.documentType, "accident_report");
  assert.deepEqual(doc.embedding, [0.1, 0.2, 0.3]);
  assert.ok(doc.incidentTypes.includes("落下"));
  assert.ok(doc.incidentTypes.includes("天井"));
  assert.equal(doc.metadata.hasPhotos, true);
  assert.equal(doc.metadata.photoCount, 1);
  assert.equal(doc.metadata.humanEdited, true);
  assert.equal(doc.sourceUpdatedAt, baseReport.updatedAt);
});

test("buildReportSearchDocument: empty photos / no feedbacks", () => {
  const r = { ...baseReport, photos: [], feedbacks: [] };
  const doc = buildReportSearchDocument({
    report: r,
    site,
    embedding: [],
    text: "x",
    indexedAt: "2026-05-28T05:00:00Z",
    sourceUpdatedAt: r.updatedAt,
  });
  assert.equal(doc.metadata.hasPhotos, false);
  assert.equal(doc.metadata.photoCount, 0);
  assert.equal(doc.metadata.humanEdited, false);
});
