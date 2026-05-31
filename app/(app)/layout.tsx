import { redirect } from "next/navigation";
import { getCurrentSiteFromCookies } from "@/lib/demo-auth";
import { AppShell } from "@/app/_components/app-shell";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const site = await getCurrentSiteFromCookies();
  if (!site) redirect("/login");

  return (
    <AppShell
      initialSession={{
        siteKey: site.siteKey,
        siteName: site.name,
        facilityId: site.facilityId,
        locationKey: site.locationKey,
      }}
    >
      {children}
    </AppShell>
  );
}
