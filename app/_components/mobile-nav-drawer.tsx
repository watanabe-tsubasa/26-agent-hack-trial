"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Home, Search, Sparkles, X } from "lucide-react";
import { GoodjobAvatar } from "@/components/goodjob-avatar";
import { LogoutButton } from "./header-bar";
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
  onClose: () => void;
};

export function MobileNavDrawer({ open, session, onClose }: Props) {
  const pathname = usePathname();
  if (!open) return null;
  const items = navItemsForRole(session.role);

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div
        className="absolute inset-0 bg-slate-950/40"
        onClick={onClose}
        aria-hidden
      />
      <aside className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <GoodjobAvatar tone="idle" size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">
                事故報お任せグッジョくん
              </p>
              <p className="text-xs text-slate-500 truncate">{session.siteName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="メニューを閉じる"
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {items.map((item) => {
            const Icon = ICONS[item.iconKey];
            const active = isActivePath(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" strokeWidth={1.75} />
                <div className="min-w-0">
                  <div className="font-medium leading-tight">{item.label}</div>
                  <div className="text-[11px] text-slate-500 leading-tight">
                    {item.description}
                  </div>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 p-3 flex justify-end">
          <LogoutButton variant="solid" />
        </div>
      </aside>
    </div>
  );
}
