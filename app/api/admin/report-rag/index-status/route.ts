import { requireAdminSession } from "@/lib/auth/demo-auth";
import {
  countReportSearchDocuments,
  getLastIndexedAt,
} from "@/lib/report-rag/cosmos-report-search";
import { isReportRagEnabled } from "@/lib/report-rag/cosmos-rag";

export async function GET() {
  try {
    await requireAdminSession();
  } catch {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  if (!isReportRagEnabled()) {
    return Response.json({ enabled: false, indexedDocuments: 0, lastIndexedAt: null });
  }
  const [indexedDocuments, lastIndexedAt] = await Promise.all([
    countReportSearchDocuments(),
    getLastIndexedAt(),
  ]);
  return Response.json({ enabled: true, indexedDocuments, lastIndexedAt });
}
