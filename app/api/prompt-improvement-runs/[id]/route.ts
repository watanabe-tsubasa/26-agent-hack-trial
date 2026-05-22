import { NextRequest } from "next/server";
import { getPromptImprovementRun } from "@/lib/prompt-improvement-run-repository";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const run = await getPromptImprovementRun(id);
  if (!run) {
    return Response.json({ error: "run not found" }, { status: 404 });
  }

  return Response.json({ run });
}
