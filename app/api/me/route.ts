import { getCurrentSiteFromCookies } from "@/lib/demo-auth";

export async function GET() {
  const site = await getCurrentSiteFromCookies();
  if (!site) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json({
    siteKey: site.siteKey,
    siteName: site.name,
    facilityId: site.facilityId,
    locationKey: site.locationKey,
    mediaMode: site.mediaMode,
  });
}
