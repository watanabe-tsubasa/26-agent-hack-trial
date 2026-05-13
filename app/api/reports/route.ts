import { NextRequest } from "next/server";
import { createReport, getAllReports } from "@/lib/report-store";
import type { CreateReportInput } from "@/lib/types";

export async function GET() {
  const reports = getAllReports();
  return Response.json(reports);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as CreateReportInput;
  const reportId = await createReport(body);
  return Response.json({ reportId, status: "processing" }, { status: 201 });
}
