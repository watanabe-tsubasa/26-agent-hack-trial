import { NextRequest } from "next/server";
import { getLatestPromptImprovementRun } from "@/lib/prompt-improvement/prompt-improvement-run-repository";

export async function GET(req: NextRequest) {
  const locationKey = req.nextUrl.searchParams.get("locationKey");
  if (!locationKey) {
    return Response.json({ error: "locationKey is required" }, { status: 400 });
  }

  const run = await getLatestPromptImprovementRun(locationKey);
  const canCreateNewRun =
    !run || (run.status !== "queued" && run.status !== "running");

  return Response.json({ run, canCreateNewRun });
}
