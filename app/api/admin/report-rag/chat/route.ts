import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/auth/demo-auth";
import { classifyAdminRagQuery } from "@/lib/report-rag/classify-query";
import { aggregateReportsByFacility } from "@/lib/report-rag/aggregate-reports";
import { searchReportsByText } from "@/lib/report-rag/search-reports";
import { generateRagAnswer, type ChatHistoryItem } from "@/lib/report-rag/answer";
import { detectFollowUp } from "@/lib/report-rag/detect-follow-up";

type ChatSource = {
  reportId: string;
  title: string;
  facilityId: string;
  siteName: string;
  url: string;
  createdAt: string;
};

type PreviousSourceRef = { reportId: string; facilityId?: string };

type ChatRequest = {
  message?: string;
  history?: ChatHistoryItem[];
  previousSources?: PreviousSourceRef[];
};

function sanitizeHistory(history: unknown): ChatHistoryItem[] {
  if (!Array.isArray(history)) return [];
  return history
    .filter((h): h is ChatHistoryItem =>
      !!h &&
      typeof h === "object" &&
      (h as ChatHistoryItem).role !== undefined &&
      typeof (h as ChatHistoryItem).content === "string"
    )
    .map((h) => ({
      role: h.role === "assistant" ? "assistant" : "user",
      content: h.content,
    }));
}

function sanitizePreviousSources(sources: unknown): PreviousSourceRef[] {
  if (!Array.isArray(sources)) return [];
  return sources
    .filter((s): s is PreviousSourceRef =>
      !!s && typeof s === "object" && typeof (s as PreviousSourceRef).reportId === "string"
    )
    .map((s) => ({ reportId: s.reportId, facilityId: s.facilityId }));
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminSession();
  } catch {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as ChatRequest | null;
  const message = body?.message?.trim();
  if (!message) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  const history = sanitizeHistory(body?.history);
  const previousSources = sanitizePreviousSources(body?.previousSources);
  const mode = classifyAdminRagQuery(message);
  const isFollowUp = detectFollowUp(message) && previousSources.length > 0;

  try {
    if (mode === "aggregate") {
      const aggregate = await aggregateReportsByFacility();
      const { answer } = await generateRagAnswer({ mode, message, aggregate, history });
      return Response.json({
        answer,
        mode,
        sources: [] as ChatSource[],
        isFollowUp: false,
      });
    }

    const scopeReportIds = isFollowUp ? previousSources.map((s) => s.reportId) : undefined;
    const hits = await searchReportsByText(message, { scopeReportIds });
    const sources: ChatSource[] = hits.map((h) => ({
      reportId: h.reportId,
      title: h.title,
      facilityId: h.facilityId,
      siteName: h.siteName,
      createdAt: h.createdAt,
      url: `/reports/${h.reportId}`,
    }));
    const { answer } = await generateRagAnswer({ mode, message, sources: hits, history });
    return Response.json({ answer, mode, sources, isFollowUp });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
