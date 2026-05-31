import { requireCurrentSite } from "@/lib/demo-auth";
import { PromptImprovementsClient } from "./_components/PromptImprovementsClient";

export default async function PromptImprovementsPage() {
  const site = await requireCurrentSite();
  return <PromptImprovementsClient locationKey={site.locationKey} siteName={site.name} />;
}
