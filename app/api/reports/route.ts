import { NextRequest } from "next/server";
import type { CreateReportInput } from "@/lib/types";
import { createQueuedReport, searchReports } from "@/lib/report-repository";
import { enqueueReportGeneration } from "@/lib/service-bus";
import { getCurrentSiteFromCookies } from "@/lib/demo-auth";

export async function GET(request: NextRequest) {
  const site = await getCurrentSiteFromCookies();
  if (!site) return Response.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const reports = await searchReports({
    facilityId: site.facilityId,
    keyword: url.searchParams.get("keyword") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  return Response.json(reports);
}

export async function POST(request: NextRequest) {
  const site = await getCurrentSiteFromCookies();
  if (!site) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json()) as CreateReportInput;
  const scopedInput: CreateReportInput = { ...body, facilityId: site.facilityId };

  const reportId = await createQueuedReport(scopedInput);
  await enqueueReportGeneration(reportId);

  return Response.json({ reportId, status: "queued" }, { status: 202 });
}
