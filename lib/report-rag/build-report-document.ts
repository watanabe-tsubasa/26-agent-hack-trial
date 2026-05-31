import type { Report } from "../types";
import type { DemoSite } from "../auth/demo-sites";
import type { ReportSearchDocument } from "./types";

const RISK_KEYWORDS = [
  "転倒",
  "落下",
  "天井",
  "ガラス",
  "破損",
  "救助",
  "エスカレーター",
  "出火",
  "漏水",
  "雨漏り",
  "怪我",
  "受傷",
  "感電",
  "停電",
  "停止",
];

export function buildReportSearchText(report: Report): string {
  const parts: string[] = [];
  if (report.title) parts.push(`タイトル: ${report.title}`);
  if (report.summary) parts.push(`概要: ${report.summary}`);
  if (report.location) parts.push(`発生場所: ${report.location}`);

  const five = report.fiveWTwoH;
  if (five) {
    if (five.when) parts.push(`いつ: ${five.when}`);
    if (five.where) parts.push(`どこで: ${five.where}`);
    if (five.who) parts.push(`誰が: ${five.who}`);
    if (five.what) parts.push(`なにを: ${five.what}`);
    if (five.why) parts.push(`なぜ: ${five.why}`);
    if (five.how) parts.push(`どのように: ${five.how}`);
    if (five.howMuch) parts.push(`規模/影響: ${five.howMuch}`);
  }

  if (report.cause) parts.push(`原因: ${report.cause}`);
  if (report.treatment) parts.push(`処置: ${report.treatment}`);
  if (report.preventiveAction) parts.push(`再発防止: ${report.preventiveAction}`);
  if (report.body) parts.push(`本文: ${report.body}`);

  if (report.victim?.hasVictim) {
    parts.push(
      `被害者: ${report.victim.category} / 程度: ${report.victim.damageLevel}` +
        (report.victim.note ? ` / 備考: ${report.victim.note}` : "")
    );
  }

  return parts.join("\n");
}

function extractIncidentTypes(text: string): string[] {
  return RISK_KEYWORDS.filter((kw) => text.includes(kw));
}

function extractLocations(report: Report): string[] {
  const list: string[] = [];
  if (report.location) list.push(report.location);
  if (report.fiveWTwoH?.where && !list.includes(report.fiveWTwoH.where)) {
    list.push(report.fiveWTwoH.where);
  }
  return list;
}

function buildDocumentId(reportId: string): string {
  return `report_${reportId}_summary`;
}

export function buildReportSearchDocument(args: {
  report: Report;
  site: DemoSite;
  embedding: number[];
  text: string;
  indexedAt: string;
  sourceUpdatedAt: string;
}): ReportSearchDocument {
  const { report, site, embedding, text, indexedAt, sourceUpdatedAt } = args;
  const incidentTypes = extractIncidentTypes(text);
  const photos = report.photos ?? [];

  return {
    id: buildDocumentId(report.id),
    documentType: "accident_report",
    reportId: report.id,
    facilityId: site.facilityId,
    siteKey: site.siteKey,
    siteName: site.name,
    status: report.status,
    title: report.title || "事故報告書",
    incidentTypes,
    locations: extractLocations(report),
    occurredAt: report.occurredAt ?? null,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    sourceUpdatedAt,
    indexedAt,
    text,
    embedding,
    metadata: {
      hasPhotos: photos.length > 0,
      photoCount: photos.length,
      humanEdited: (report.feedbacks ?? []).length > 0,
      riskKeywords: incidentTypes,
    },
  };
}

export const __test__ = { buildDocumentId, extractIncidentTypes, extractLocations };
