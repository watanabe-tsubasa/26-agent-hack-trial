import { NextRequest } from "next/server";
import type { CreateReportInput } from "@/lib/types";
import { createQueuedReport, getAllReports } from "@/lib/report-repository";
import { enqueueReportGeneration } from "@/lib/service-bus";

export async function GET() {
  const reports = await getAllReports();
  return Response.json(reports);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as CreateReportInput;

  const reportId = await createQueuedReport(body);
  await enqueueReportGeneration(reportId);

  return Response.json({ reportId, status: "queued" }, { status: 202 });
}
