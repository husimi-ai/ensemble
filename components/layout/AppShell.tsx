"use client";

import { useState, type ReactNode } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { Sidebar } from "@/components/sidebar/Sidebar";

/**
 * The authed app chrome: a collapsible sidebar + top bar wrapped around the
 * routed `children`. Holds only UI state (sidebar open, settings modal); the
 * session comes from context (see `app/providers`). Collapse animates the
 * wrapper width 0<->260px per the design system.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-canvas">
      <div
        className="h-full shrink-0 overflow-hidden transition-[width] duration-200 ease-out"
        style={{ width: sidebarOpen ? "var(--sidebar-w)" : "0px" }}
      >
        <Sidebar
          onCollapse={() => setSidebarOpen(false)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </div>

      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar sidebarOpen={sidebarOpen} onOpenSidebar={() => setSidebarOpen(true)} />
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
