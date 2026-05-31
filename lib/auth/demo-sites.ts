export const SITE_COOKIE_NAME = "site_key";
export const ADMIN_SITE_KEY = "admin";

export type SiteKey = "kanda-office" | "aeon-mall-kanda";

export type MediaMode = "video_frames" | "sample_scenes";

export type DemoRole = "site_user" | "admin";

export type DemoSite = {
  siteKey: SiteKey;
  facilityId: string;
  locationKey: string;
  name: string;
  description: string;
  mediaMode: MediaMode;
};

export type DemoUser = {
  loginId: string;
  password: string;
  role: DemoRole;
  /** site_user の場合は SiteKey、admin の場合は ADMIN_SITE_KEY */
  siteKey: string;
};

export const DEMO_SITES: readonly DemoSite[] = [
  {
    siteKey: "kanda-office",
    facilityId: "kanda-office",
    locationKey: "kanda-office",
    name: "神田事務所サイト",
    description: "イオンディライト神田本社",
    mediaMode: "video_frames",
  },
  {
    siteKey: "aeon-mall-kanda",
    facilityId: "aeon-mall-kanda",
    locationKey: "aeon-mall-kanda",
    name: "イオンモール神田サイト",
    description: "デモ用架空店舗",
    mediaMode: "sample_scenes",
  },
] as const;

export const DEMO_USERS: readonly DemoUser[] = [
  { loginId: "kanda", password: "goodjob", role: "site_user", siteKey: "kanda-office" },
  { loginId: "mall", password: "goodjob", role: "site_user", siteKey: "aeon-mall-kanda" },
  { loginId: "admin", password: "goodjob", role: "admin", siteKey: ADMIN_SITE_KEY },
] as const;

export const ADMIN_DISPLAY_NAME = "全施設管理";

export function findSiteByKey(siteKey: string | undefined | null): DemoSite | null {
  if (!siteKey) return null;
  return DEMO_SITES.find((s) => s.siteKey === siteKey) ?? null;
}

export function findUserByCredentials(loginId: string, password: string): DemoUser | null {
  return (
    DEMO_USERS.find((u) => u.loginId === loginId && u.password === password) ?? null
  );
}

export function findUserBySiteKey(siteKey: string | undefined | null): DemoUser | null {
  if (!siteKey) return null;
  return DEMO_USERS.find((u) => u.siteKey === siteKey) ?? null;
}

export function isAdminSiteKey(siteKey: string | undefined | null): boolean {
  return siteKey === ADMIN_SITE_KEY;
}
