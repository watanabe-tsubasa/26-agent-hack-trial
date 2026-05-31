import { findSiteByKey } from "../auth/demo-sites";
import { buildReportSearchDocument, buildReportSearchText } from "./build-report-document";
import { embedText } from "./embedding";
import { isReportRagEnabled } from "./cosmos-rag";
import {
  getReportSearchDocument,
  upsertReportSearchDocument,
} from "./cosmos-report-search";
import {
  getIndexableReport,
  listIndexableReports,
  type IndexableReportRow,
} from "./list-reports-for-indexing";
import { INDEXABLE_STATUSES } from "./types";

export type IndexResult = "indexed" | "skipped" | "failed";

async function indexRow(
  row: IndexableReportRow,
  options: { force: boolean }
): Promise<IndexResult> {
  if (!row.facilityId) return "skipped";
  if (!INDEXABLE_STATUSES.includes(row.report.status as never)) return "skipped";

  const site = findSiteByKey(row.facilityId);
  if (!site) return "skipped";

  if (!options.force) {
    const existing = await getReportSearchDocument(row.report.id, row.facilityId);
    if (existing && existing.sourceUpdatedAt === row.sourceUpdatedAt) {
      return "skipped";
    }
  }

  try {
    const text = buildReportSearchText(row.report);
    const embedding = await embedText(text);
    const doc = buildReportSearchDocument({
      report: row.report,
      site,
      embedding,
      text,
      indexedAt: new Date().toISOString(),
      sourceUpdatedAt: row.sourceUpdatedAt,
    });
    await upsertReportSearchDocument(doc);
    return "indexed";
  } catch (err) {
    console.warn(`[rag-index] failed reportId=${row.report.id}`, err);
    return "failed";
  }
}

/** confirm 時の best-effort 呼び出し */
export async function indexReportForRag(reportId: string): Promise<void> {
  if (!isReportRagEnabled()) return;
  try {
    const row = await getIndexableReport(reportId);
    if (!row) return;
    await indexRow(row, { force: true });
  } catch (err) {
    console.warn("[rag-index] indexReportForRag failed", err);
  }
}

export async function reindexAllReports(options: { force?: boolean } = {}): Promise<{
  indexed: number;
  skipped: number;
  failed: number;
}> {
  if (!isReportRagEnabled()) {
    return { indexed: 0, skipped: 0, failed: 0 };
  }
  const rows = await listIndexableReports();
  const force = options.force === true;
  let indexed = 0;
  let skipped = 0;
  let failed = 0;
  for (const row of rows) {
    const result = await indexRow(row, { force });
    if (result === "indexed") indexed += 1;
    else if (result === "skipped") skipped += 1;
    else failed += 1;
  }
  return { indexed, skipped, failed };
}
