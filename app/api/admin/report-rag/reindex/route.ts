import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/auth/demo-auth";
import { reindexAllReports } from "@/lib/report-rag/index-report";
import { isReportRagEnabled } from "@/lib/report-rag/cosmos-rag";

export async function POST(request: NextRequest) {
  try {
    await requireAdminSession();
  } catch {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  if (!isReportRagEnabled()) {
    return Response.json(
      { error: "Cosmos RAG is not enabled" },
      { status: 503 }
    );
  }

  const body = (await request.json().catch(() => null)) as { force?: boolean } | null;
  const force = body?.force === true;
  const result = await reindexAllReports({ force });
  return Response.json(result);
}
