import { redirect } from "next/navigation";
import { getCurrentSessionFromCookies } from "@/lib/auth/demo-auth";
import { ReportRagChatClient } from "./_components/ReportRagChatClient";
import { getAppEnv } from "@/lib/env";

export default async function ReportRagPage() {
  const env = getAppEnv();
  const session = await getCurrentSessionFromCookies();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/");
  return <ReportRagChatClient env={env} />;
}
