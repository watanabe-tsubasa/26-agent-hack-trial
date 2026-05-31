import { redirect } from "next/navigation";
import { getCurrentSessionFromCookies } from "@/lib/auth/demo-auth";
import { ReportRagChatClient } from "./_components/ReportRagChatClient";

export default async function ReportRagPage() {
  const session = await getCurrentSessionFromCookies();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/");
  return <ReportRagChatClient />;
}
