import { redirect } from "next/navigation";
import { getCurrentSessionFromCookies } from "@/lib/auth/demo-auth";
import { PromptImprovementsClient } from "./_components/PromptImprovementsClient";

export default async function PromptImprovementsPage() {
  const session = await getCurrentSessionFromCookies();
  if (!session) redirect("/login");
  if (session.role !== "site_user") redirect("/admin/report-rag");
  const { site } = session;
  return <PromptImprovementsClient locationKey={site.locationKey} siteName={site.name} />;
}
