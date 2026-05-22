import { NextRequest } from "next/server";
import { confirmReport, getReportDrafts, getReportStatus } from "@/lib/report-repository";
import { diffJson } from "@/lib/json-diff";
import { saveReportCorrection } from "@/lib/report-correction-repository";
import type { Report } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

const CONTENT_KEYS: (keyof Report)[] = [
  "title", "victim", "fiveWTwoH", "cause", "treatment", "preventiveAction", "body",
];

function extractContent(report: Report): Partial<Report> {
  return Object.fromEntries(CONTENT_KEYS.map((k) => [k, report[k]]));
}

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const row = await getReportStatus(id);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });

  try {
    const { aiDraftJson, userDraftJson } = await getReportDrafts(id);
    if (aiDraftJson && userDraftJson) {
      const aiDraft = JSON.parse(aiDraftJson) as Report;
      const userDraft = JSON.parse(userDraftJson) as Report;
      const diffItems = diffJson(extractContent(aiDraft), extractContent(userDraft));
      if (diffItems.length > 0) {
        await saveReportCorrection({ reportId: id, aiDraftJson, userDraftJson, diffItems });
      }
    }
  } catch (error) {
    console.error("Failed to save report correction (confirm will proceed):", error);
  }

  await confirmReport(id);
  return Response.json({ reportId: id, status: "confirmed" });
}
