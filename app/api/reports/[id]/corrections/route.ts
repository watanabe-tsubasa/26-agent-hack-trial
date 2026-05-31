import { NextRequest } from "next/server";
import { getReportStatus } from "@/lib/reports/report-repository";
import { getCorrectionsForReport } from "@/lib/reports/report-correction-repository";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const row = await getReportStatus(id);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });

  const corrections = await getCorrectionsForReport(id);
  return Response.json({
    reportId: id,
    corrections: corrections.map((c) => ({
      id: c.id,
      diff: c.diffItems,
      createdAt: c.createdAt,
    })),
  });
}
