import { getReportRagContainer } from "./cosmos-rag";
import { embedText } from "./embedding";

export type ReportSearchHit = {
  reportId: string;
  title: string;
  facilityId: string;
  siteName: string;
  snippet: string;
  occurredAt: string | null;
  createdAt: string;
  distance: number;
};

const DEFAULT_K = 5;

export async function searchReportsByText(
  message: string,
  k: number = DEFAULT_K
): Promise<ReportSearchHit[]> {
  const container = getReportRagContainer();
  if (!container) return [];

  const query = await embedText(message);

  try {
    const { resources } = await container.items
      .query<{
        reportId: string;
        title: string;
        facilityId: string;
        siteName: string;
        text: string;
        occurredAt: string | null;
        createdAt: string;
        distance: number;
      }>({
        query: `
          SELECT TOP @k
            c.reportId, c.title, c.facilityId, c.siteName,
            c.text, c.occurredAt, c.createdAt,
            VectorDistance(c.embedding, @query) AS distance
          FROM c
          WHERE c.documentType = 'accident_report'
            AND c.status = 'confirmed'
          ORDER BY VectorDistance(c.embedding, @query)
        `,
        parameters: [
          { name: "@k", value: k },
          { name: "@query", value: query },
        ],
      })
      .fetchAll();

    return resources.map((r) => ({
      reportId: r.reportId,
      title: r.title,
      facilityId: r.facilityId,
      siteName: r.siteName,
      snippet: r.text.slice(0, 240),
      occurredAt: r.occurredAt,
      createdAt: r.createdAt,
      distance: r.distance,
    }));
  } catch (err) {
    console.warn("searchReportsByText failed", err);
    return [];
  }
}
