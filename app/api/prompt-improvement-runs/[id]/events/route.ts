import { NextRequest } from "next/server";
import { listAgentEventsByRun } from "@/lib/agent-event-log";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const events = await listAgentEventsByRun(id);
  return Response.json({ events });
}
