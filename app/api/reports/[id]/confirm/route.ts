import { NextRequest } from "next/server";
import { confirmReport } from "@/lib/report-store";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const confirmed = confirmReport(id);
  if (!confirmed) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ reportId: id, status: "confirmed" });
}
