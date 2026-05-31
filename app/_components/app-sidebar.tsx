"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Home, Search, Sparkles } from "lucide-react";
import { GoodjobAvatar } from "@/components/goodjob-avatar";
import type { AppSession } from "./app-session";
import { isActivePath, navItemsForRole, type NavIconKey } from "./nav-items";

const ICONS: Record<NavIconKey, typeof Home> = {
  home: Home,
  fileText: FileText,
  sparkles: Sparkles,
  search: Search,
};

type Props = {
  open: boolean;
  session: AppSession;
};

export function AppSidebar({ open, session }: Props) {
  const pathname = usePathname();
  const items = navItemsForRole(session.role);

  return (
    <aside
      className={`hidden md:flex flex-col border-r border-slate-200 bg-white transition-[width] duration-200 ease-in-out ${
        open ? "w-64" : "w-16"
      }`}
    >
      <div className="px-3 py-4 border-b border-slate-100 flex items-center gap-3">
        <GoodjobAvatar tone="idle" size="sm" />
        {open && (
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate">
              事故報お任せグッジョくん
            </p>
            <p className="text-[11px] text-slate-500 truncate">{session.siteName}</p>
          </div>
        )}
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {items.map((item) => {
          const Icon = ICONS[item.iconKey];
          const active = isActivePath(item.href, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" strokeWidth={1.75} />
              {open && (
                <div className="min-w-0">
                  <div className="font-medium leading-tight">{item.label}</div>
                  <div className="text-[11px] text-slate-500 leading-tight truncate">
                    {item.description}
                  </div>
                </div>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
