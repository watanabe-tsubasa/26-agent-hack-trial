export const SITE_COOKIE_NAME = "site_key";

export type SiteKey = "kanda-office" | "aeon-mall-kanda";

export type MediaMode = "video_frames" | "sample_scenes";

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
  siteKey: SiteKey;
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
  { loginId: "kanda", password: "goodjob", siteKey: "kanda-office" },
  { loginId: "mall", password: "goodjob", siteKey: "aeon-mall-kanda" },
] as const;

export function findSiteByKey(siteKey: string | undefined | null): DemoSite | null {
  if (!siteKey) return null;
  return DEMO_SITES.find((s) => s.siteKey === siteKey) ?? null;
}

export function findUserByCredentials(loginId: string, password: string): DemoUser | null {
  return (
    DEMO_USERS.find((u) => u.loginId === loginId && u.password === password) ?? null
  );
}
