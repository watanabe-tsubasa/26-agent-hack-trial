import { NextRequest } from "next/server";
import { listLocationPromptOverrides } from "@/lib/prompt-improvement/location-prompt-override-repository";

export async function GET(req: NextRequest) {
  const locationKey = req.nextUrl.searchParams.get("locationKey") ?? undefined;
  const overrides = await listLocationPromptOverrides(locationKey);
  return Response.json({ overrides });
}
