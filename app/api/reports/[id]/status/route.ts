import { NextRequest } from "next/server";
import { getReportStatus } from "@/lib/reports/report-repository";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const row = await getReportStatus(id);

  if (!row) return Response.json({ error: "Not found" }, { status: 404 });

  const processingStatuses = ["queued", "generating_report"];
  const isProcessing = processingStatuses.includes(row.status);

  return Response.json({
    reportId: id,
    status: row.status,
    isProcessing,
    errorMessage: row.error_message ?? null,
    updatedAt: row.updated_at,
  });
}
