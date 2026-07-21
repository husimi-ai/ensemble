"use client";

import { MessageCircleDashed, PanelLeft, Sparkles } from "lucide-react";
import { ModelSwitcher } from "@/components/layout/ModelSwitcher";
import { IconButton } from "@/components/ui/IconButton";

type Props = {
  sidebarOpen: boolean;
  onOpenSidebar: () => void;
  onNewChat: () => void;
};

export function TopBar({ sidebarOpen, onOpenSidebar, onNewChat }: Props) {
  return (
    <header className="flex h-header items-center justify-between px-2">
      <div className="flex items-center gap-1">
        {!sidebarOpen && (
          <IconButton label="Open sidebar" onClick={onOpenSidebar}>
            <PanelLeft size={20} />
          </IconButton>
        )}
        <ModelSwitcher />
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-accent hover:bg-hover"
        >
          <Sparkles size={16} />
          Upgrade
        </button>
        <IconButton label="Temporary chat" onClick={onNewChat}>
          <MessageCircleDashed size={20} />
        </IconButton>
      </div>
    </header>
  );
}
