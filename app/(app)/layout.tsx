import { redirect } from "next/navigation";
import { getCurrentSessionFromCookies } from "@/lib/auth/demo-auth";
import { AppShell } from "@/app/_components/app-shell";
import type { AppSession } from "@/app/_components/app-session";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSessionFromCookies();
  if (!session) redirect("/login");

  const appSession: AppSession =
    session.role === "admin"
      ? { role: "admin", siteName: session.siteName }
      : {
          role: "site_user",
          siteKey: session.site.siteKey,
          siteName: session.site.name,
          facilityId: session.site.facilityId,
          locationKey: session.site.locationKey,
        };

  return <AppShell initialSession={appSession}>{children}</AppShell>;
}
