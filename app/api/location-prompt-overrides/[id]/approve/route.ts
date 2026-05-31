import { NextRequest } from "next/server";
import { approveLocationPromptOverride } from "@/lib/prompt-improvement/location-prompt-override-repository";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await approveLocationPromptOverride(id);
    return Response.json({ id, status: "active" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 404 });
  }
}
