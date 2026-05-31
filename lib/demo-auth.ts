import { cookies } from "next/headers";
import { findSiteByKey, SITE_COOKIE_NAME, type DemoSite } from "./demo-sites";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

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

export async function getCurrentSiteFromCookies(): Promise<DemoSite | null> {
  const store = await cookies();
  const value = store.get(SITE_COOKIE_NAME)?.value;
  return findSiteByKey(value);
}

export async function requireCurrentSite(): Promise<DemoSite> {
  const site = await getCurrentSiteFromCookies();
  if (!site) throw new Error("UNAUTHORIZED");
  return site;
}
