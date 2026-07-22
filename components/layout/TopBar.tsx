"use client";

import { PanelLeft } from "lucide-react";
import { usePathname } from "next/navigation";
import { titleForPath } from "@/components/nav/navConfig";
import { IconButton } from "@/components/ui/IconButton";

type Props = {
  sidebarOpen: boolean;
  onOpenSidebar: () => void;
};

/**
 * The app top bar (52px): a sidebar-reopen button when collapsed, plus the
 * current surface's title derived from the route.
 */
export function TopBar({ sidebarOpen, onOpenSidebar }: Props) {
  const pathname = usePathname();
  const title = titleForPath(pathname);

  return (
    <header className="flex h-header items-center gap-1 px-2">
      {!sidebarOpen && (
        <IconButton label="Open sidebar" onClick={onOpenSidebar}>
          <PanelLeft size={20} />
        </IconButton>
      )}
      <h1 className="px-2 text-lg font-semibold text-fg">{title}</h1>
    </header>
  );
}
