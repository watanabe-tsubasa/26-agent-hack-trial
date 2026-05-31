export type NavIconKey = "home" | "fileText" | "sparkles";

export type NavItem = {
  href: string;
  label: string;
  description: string;
  iconKey: NavIconKey;
};

export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/",
    label: "ホーム",
    description: "事故報作成",
    iconKey: "home",
  },
  {
    href: "/reports",
    label: "事故報一覧",
    description: "作成済み事故報を確認",
    iconKey: "fileText",
  },
  {
    href: "/admin/prompt-improvements",
    label: "施設ナレッジ改善",
    description: "グッジョくんが修正履歴から施設知識を整理",
    iconKey: "sparkles",
  },
] as const;

export function isActivePath(itemHref: string, pathname: string): boolean {
  if (itemHref === "/") return pathname === "/";
  return pathname === itemHref || pathname.startsWith(`${itemHref}/`);
}
