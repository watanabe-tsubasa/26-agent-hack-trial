import { getCurrentSessionFromCookies } from "@/lib/auth/demo-auth";

export async function GET() {
  const session = await getCurrentSessionFromCookies();
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.role === "admin") {
    return Response.json({ role: "admin", siteName: session.siteName });
  }
  const { site } = session;
  return Response.json({
    role: "site_user",
    siteKey: site.siteKey,
    siteName: site.name,
    facilityId: site.facilityId,
    locationKey: site.locationKey,
    mediaMode: site.mediaMode,
  });
}
