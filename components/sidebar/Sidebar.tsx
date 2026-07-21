"use client";

import type { ComponentType } from "react";
import { useState } from "react";
import {
  IconCodex,
  IconFolder,
  IconHomework,
  IconLibrary,
  IconMore,
  IconNewChat,
  IconPanelToggle,
  IconPlugins,
  IconSearch,
} from "@/components/icons";
import { AccountMenu } from "@/components/sidebar/AccountMenu";
import { SidebarRow } from "@/components/sidebar/SidebarRow";
import { IconButton } from "@/components/ui/IconButton";

type IconCmp = ComponentType<{ size?: number; className?: string }>;
type NavItem = { icon: IconCmp; label: string; active?: boolean };

const NAV: NavItem[] = [
  { icon: IconNewChat, label: "New chat", active: true },
  { icon: IconLibrary, label: "Library" },
  { icon: IconPlugins, label: "Plugins" },
  { icon: IconCodex, label: "Codex" },
  { icon: IconMore, label: "More" },
];

const PROJECTS = [
  "Avelero-research",
  "BiBTEX",
  "Keerpunten in informatiewete…",
  "Prompt -writer",
  "Homework",
];
const CHATS = [
  "Husimi Q-function Explained",
  "Ouder Uitzien Betekenis",
  "Weapon System Design Research",
  "AI Lead Finder Verbetering",
  "OpenClaw Token Consumption",
  "Improve sleep duration",
];

type Props = {
  onCollapse: () => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
};

export function Sidebar({ onCollapse, onNewChat, onOpenSettings }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <aside className="flex h-full w-sidebar shrink-0 flex-col bg-sidebar">
      {/* brand + search + collapse */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="grid h-8 w-8 place-items-center rounded-full bg-primary text-sm font-semibold text-fg-inverted">
          E
        </div>
        <div className="flex items-center gap-1">
          <IconButton label="Search chats">
            <IconSearch size={20} />
          </IconButton>
          <IconButton label="Collapse sidebar" onClick={onCollapse}>
            <IconPanelToggle size={20} />
          </IconButton>
        </div>
      </div>

      {/* scrollable middle */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ icon: Icon, label, active }) => (
            <button
              key={label}
              type="button"
              onClick={label === "New chat" ? onNewChat : undefined}
              className={`flex min-h-9 items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-sm text-fg hover:bg-hover ${
                active ? "bg-muted" : ""
              }`}
            >
              <Icon size={20} className="shrink-0 text-fg" />
              {label}
            </button>
          ))}
        </nav>

        <Section title="Projects">
          {PROJECTS.map((name) =>
            name === "Homework" ? (
              <SidebarRow key={name} icon={IconHomework} iconClassName="text-accent" label={name} />
            ) : (
              <SidebarRow key={name} icon={IconFolder} label={name} />
            ),
          )}
        </Section>

        <Section title="Chats">
          {CHATS.map((name) => (
            <SidebarRow key={name} label={name} />
          ))}
        </Section>
      </div>

      {/* account + upgrade */}
      <div className="relative p-2">
        <AccountMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          onOpenSettings={onOpenSettings}
        />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-left hover:bg-hover"
          >
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium text-fg-secondary">
              M
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-fg">Moussa Ouallaf</div>
              <div className="truncate text-xs text-fg-muted">Free</div>
            </div>
          </button>
          <button
            type="button"
            className="shrink-0 rounded-full border border-line px-3.5 py-1.5 text-sm font-medium text-fg hover:bg-hover"
          >
            Upgrade
          </button>
        </div>
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="px-2.5 pb-1 pt-2 text-sm font-semibold text-fg">{title}</div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}
