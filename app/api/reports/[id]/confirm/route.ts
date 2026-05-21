import { NextRequest } from "next/server";
import { confirmReport, getReportStatus } from "@/lib/report-repository";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const row = await getReportStatus(id);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  await confirmReport(id);
  return Response.json({ reportId: id, status: "confirmed" });
}
