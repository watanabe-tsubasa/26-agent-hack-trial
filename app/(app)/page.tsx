import { redirect } from "next/navigation";
import { getCurrentSessionFromCookies } from "@/lib/auth/demo-auth";
import { NewReportForm } from "./_components/new-report-form";

export default async function NewReportPage() {
  const session = await getCurrentSessionFromCookies();
  if (!session) redirect("/login");
  if (session.role !== "site_user") redirect("/admin/report-rag");
  return <NewReportForm />;
}
