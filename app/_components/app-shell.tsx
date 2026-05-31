"use client";

import { useState } from "react";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import { MobileNavDrawer } from "./mobile-nav-drawer";
import type { AppSession } from "./app-session";

type Props = {
  initialSession: AppSession;
  children: React.ReactNode;
};

export function AppShell({ initialSession, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AppHeader
        session={initialSession}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onOpenMobileNav={() => setMobileOpen(true)}
      />
      <div className="flex flex-1 min-h-0">
        <AppSidebar open={sidebarOpen} session={initialSession} />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
      <MobileNavDrawer
        open={mobileOpen}
        session={initialSession}
        onClose={() => setMobileOpen(false)}
      />
    </div>
  );
}
