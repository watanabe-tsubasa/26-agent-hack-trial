"use client";

import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { GoodjobAvatar } from "@/components/goodjob-avatar";
import { LogoutButton } from "./header-bar";
import type { AppSession } from "./app-session";

type Props = {
  session: AppSession;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenMobileNav: () => void;
};

export function AppHeader({
  session,
  sidebarOpen,
  onToggleSidebar,
  onOpenMobileNav,
}: Props) {
  return (
    <header className="bg-blue-900 text-white shadow-md">
      <div className="px-3 sm:px-4 py-2.5 flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? "サイドバーを閉じる" : "サイドバーを開く"}
          className="hidden md:inline-flex items-center justify-center w-8 h-8 rounded-md text-blue-100 hover:bg-blue-800"
        >
          {sidebarOpen ? (
            <PanelLeftClose className="w-5 h-5" />
          ) : (
            <PanelLeftOpen className="w-5 h-5" />
          )}
        </button>
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="メニューを開く"
          className="md:hidden inline-flex items-center justify-center w-8 h-8 rounded-md text-blue-100 hover:bg-blue-800"
        >
          <Menu className="w-5 h-5" />
        </button>

        <GoodjobAvatar tone="idle" size="sm" className="hidden sm:inline-block" />
        <div className="min-w-0">
          <h1 className="text-base font-bold tracking-wide leading-tight truncate">
            事故報お任せグッジョくん
          </h1>
          <p className="text-blue-200 text-xs truncate">{session.siteName}</p>
        </div>

        <div className="ml-auto">
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
