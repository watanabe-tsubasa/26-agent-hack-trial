import { NextRequest } from "next/server";
import { getProcessingSteps } from "@/lib/report-store";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const result = getProcessingSteps(id);
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ reportId: id, ...result });
}
