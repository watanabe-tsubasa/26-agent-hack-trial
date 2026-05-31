import { cookies } from "next/headers";
import {
  ADMIN_DISPLAY_NAME,
  SITE_COOKIE_NAME,
  findSiteByKey,
  findUserBySiteKey,
  isAdminSiteKey,
  type DemoSite,
} from "../auth/demo-sites";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

export type DemoSession =
  | { role: "site_user"; site: DemoSite }
  | { role: "admin"; siteName: string };

export async function setSiteCookie(siteKey: string): Promise<void> {
  const store = await cookies();
  store.set({
    name: SITE_COOKIE_NAME,
    value: siteKey,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export async function clearSiteCookie(): Promise<void> {
  const store = await cookies();
  store.set({
    name: SITE_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getCurrentSessionFromCookies(): Promise<DemoSession | null> {
  const store = await cookies();
  const value = store.get(SITE_COOKIE_NAME)?.value;
  if (!value) return null;

  if (isAdminSiteKey(value)) {
    const user = findUserBySiteKey(value);
    if (!user || user.role !== "admin") return null;
    return { role: "admin", siteName: ADMIN_DISPLAY_NAME };
  }

  const site = findSiteByKey(value);
  if (!site) return null;
  return { role: "site_user", site };
}

export async function requireCurrentSession(): Promise<DemoSession> {
  const session = await getCurrentSessionFromCookies();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export async function requireSiteUserSession(): Promise<DemoSite> {
  const session = await requireCurrentSession();
  if (session.role !== "site_user") throw new Error("FORBIDDEN_ADMIN");
  return session.site;
}

export async function requireAdminSession(): Promise<{ siteName: string }> {
  const session = await requireCurrentSession();
  if (session.role !== "admin") throw new Error("FORBIDDEN_SITE_USER");
  return { siteName: session.siteName };
}

export async function getCurrentSiteFromCookies(): Promise<DemoSite | null> {
  const session = await getCurrentSessionFromCookies();
  if (!session || session.role !== "site_user") return null;
  return session.site;
}

export async function requireCurrentSite(): Promise<DemoSite> {
  const site = await getCurrentSiteFromCookies();
  if (!site) throw new Error("UNAUTHORIZED");
  return site;
}
