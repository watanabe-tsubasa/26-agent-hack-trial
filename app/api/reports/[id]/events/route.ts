import { NextRequest } from "next/server";
import { listAgentEventsByReport } from "@/lib/agent-event-log";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const events = await listAgentEventsByReport(id);
  return Response.json({ events });
}
