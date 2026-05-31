import { NextRequest } from "next/server";
import { findSiteByKey, findUserByCredentials } from "@/lib/demo-sites";
import { setSiteCookie } from "@/lib/demo-auth";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { loginId?: string; password?: string }
    | null;

  const loginId = body?.loginId?.trim() ?? "";
  const password = body?.password ?? "";

  if (!loginId || !password) {
    return Response.json({ error: "loginId and password are required" }, { status: 400 });
  }

  const user = findUserByCredentials(loginId, password);
  if (!user) {
    return Response.json({ error: "invalid credentials" }, { status: 401 });
  }

  const site = findSiteByKey(user.siteKey);
  if (!site) {
    return Response.json({ error: "site not found" }, { status: 500 });
  }

  await setSiteCookie(user.siteKey);
  return Response.json({ siteKey: site.siteKey, siteName: site.name });
}
