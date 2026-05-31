import { getReportRagContainer } from "./cosmos-rag";
import type { ReportSearchDocument } from "./types";

export async function upsertReportSearchDocument(
  doc: ReportSearchDocument
): Promise<void> {
  const container = getReportRagContainer();
  if (!container) return;
  try {
    await container.items.upsert(doc);
  } catch (err) {
    console.warn("upsertReportSearchDocument failed", err);
    throw err;
  }
}

export async function getReportSearchDocument(
  reportId: string,
  facilityId: string
): Promise<ReportSearchDocument | null> {
  const container = getReportRagContainer();
  if (!container) return null;
  const id = `report_${reportId}_summary`;
  try {
    const { resource } = await container
      .item(id, facilityId)
      .read<ReportSearchDocument>();
    return resource ?? null;
  } catch (err) {
    const status = (err as { code?: number }).code;
    if (status === 404) return null;
    console.warn("getReportSearchDocument failed", err);
    return null;
  }
}

export async function countReportSearchDocuments(): Promise<number> {
  const container = getReportRagContainer();
  if (!container) return 0;
  try {
    const { resources } = await container.items
      .query<{ n: number }>({
        query: "SELECT VALUE COUNT(1) FROM c WHERE c.documentType = 'accident_report'",
      })
      .fetchAll();
    const v = resources[0] as unknown;
    if (typeof v === "number") return v;
    return resources[0]?.n ?? 0;
  } catch (err) {
    console.warn("countReportSearchDocuments failed", err);
    return 0;
  }
}

export async function getLastIndexedAt(): Promise<string | null> {
  const container = getReportRagContainer();
  if (!container) return null;
  try {
    const { resources } = await container.items
      .query<{ indexedAt: string }>({
        query:
          "SELECT TOP 1 c.indexedAt FROM c WHERE c.documentType = 'accident_report' ORDER BY c.indexedAt DESC",
      })
      .fetchAll();
    return resources[0]?.indexedAt ?? null;
  } catch (err) {
    console.warn("getLastIndexedAt failed", err);
    return null;
  }
}
