import { NextRequest } from "next/server";
import { createPromptImprovementRun } from "@/lib/prompt-improvement-run-repository";
import { enqueuePromptImprovement } from "@/lib/service-bus";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const locationKey = body?.locationKey as string | undefined;
  if (!locationKey) {
    return Response.json({ error: "locationKey is required" }, { status: 400 });
  }

  const runId = await createPromptImprovementRun({ locationKey });

  try {
    await enqueuePromptImprovement({ runId, locationKey });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      { runId, locationKey, status: "queued_failed", error: message },
      { status: 500 }
    );
  }

  return Response.json(
    { runId, locationKey, status: "queued" },
    { status: 202 }
  );
}
