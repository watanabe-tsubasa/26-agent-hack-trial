import type { AppSession } from "./app-session";

export type NavIconKey = "home" | "fileText" | "sparkles" | "search";
export type RoleVisibility = AppSession["role"];

export type NavItem = {
  href: string;
  label: string;
  description: string;
  iconKey: NavIconKey;
  visibleTo: readonly RoleVisibility[];
};

export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/",
    label: "ホーム",
    description: "事故報作成",
    iconKey: "home",
    visibleTo: ["site_user"],
  },
  {
    href: "/reports",
    label: "事故報一覧",
    description: "作成済み事故報を確認",
    iconKey: "fileText",
    visibleTo: [
      "site_user", 
      // "admin" // 管理者も事故報一覧を見れた方が良さそうだが、全サイト検索・サイト別検索を実装していないので、ひとまず管理者からはこのメニューを消す --- IGNORE ---
    ],
  },
  {
    href: "/admin/prompt-improvements",
    label: "施設ナレッジ改善",
    description: "グッジョくんが修正履歴から施設知識を整理",
    iconKey: "sparkles",
    visibleTo: ["site_user"],
  },
  {
    href: "/admin/report-rag",
    label: "施設管理RAG",
    description: "全サイト横断で事故報を確認",
    iconKey: "search",
    visibleTo: ["admin"],
  },
] as const;

export function isActivePath(itemHref: string, pathname: string): boolean {
  if (itemHref === "/") return pathname === "/";
  return pathname === itemHref || pathname.startsWith(`${itemHref}/`);
}

export function navItemsForRole(role: RoleVisibility): NavItem[] {
  return NAV_ITEMS.filter((item) => item.visibleTo.includes(role));
}
