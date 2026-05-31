import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/auth/demo-auth";
import { classifyAdminRagQuery } from "@/lib/report-rag/classify-query";
import { aggregateReportsByFacility } from "@/lib/report-rag/aggregate-reports";
import { searchReportsByText } from "@/lib/report-rag/search-reports";
import { generateRagAnswer } from "@/lib/report-rag/answer";

type ChatSource = {
  reportId: string;
  title: string;
  facilityId: string;
  siteName: string;
  url: string;
  createdAt: string;
};

export async function POST(request: NextRequest) {
  try {
    await requireAdminSession();
  } catch {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { message?: string } | null;
  const message = body?.message?.trim();
  if (!message) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  const mode = classifyAdminRagQuery(message);

  try {
    if (mode === "aggregate") {
      const aggregate = await aggregateReportsByFacility();
      const { answer } = await generateRagAnswer({ mode, message, aggregate });
      return Response.json({ answer, mode, sources: [] as ChatSource[] });
    }

    const hits = await searchReportsByText(message);
    const sources: ChatSource[] = hits.map((h) => ({
      reportId: h.reportId,
      title: h.title,
      facilityId: h.facilityId,
      siteName: h.siteName,
      createdAt: h.createdAt,
      url: `/reports/${h.reportId}`,
    }));
    const { answer } = await generateRagAnswer({ mode, message, sources: hits });
    return Response.json({ answer, mode, sources });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
