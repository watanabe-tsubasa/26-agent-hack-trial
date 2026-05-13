import { NextRequest } from "next/server";
import { getReport, updateReport } from "@/lib/report-store";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const report = getReport(id);
  if (!report) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(report);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const updated = updateReport(id, body);
  if (!updated) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ reportId: id, status: "updated", savedFeedback: true });
}
