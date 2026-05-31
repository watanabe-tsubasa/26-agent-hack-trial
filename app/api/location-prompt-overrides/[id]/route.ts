import { NextRequest } from "next/server";
import {
  getLocationPromptOverride,
  updateLocationPromptOverride,
} from "@/lib/prompt-improvement/location-prompt-override-repository";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const override = await getLocationPromptOverride(id);
  if (!override) {
    return Response.json({ error: "Override not found" }, { status: 404 });
  }
  return Response.json({ override });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const title = typeof body?.title === "string" ? body.title : undefined;
  const overrideText = typeof body?.overrideText === "string" ? body.overrideText : undefined;

  if (title === undefined && overrideText === undefined) {
    return Response.json(
      { error: "title or overrideText must be provided" },
      { status: 400 }
    );
  }

  try {
    const override = await updateLocationPromptOverride({ id, title, overrideText });
    return Response.json({ override });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Override not found") {
      return Response.json({ error: message }, { status: 404 });
    }
    if (message === "Only draft overrides can be updated") {
      return Response.json({ error: message }, { status: 400 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
