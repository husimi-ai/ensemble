"use client";

import {
  AudioLines,
  Bell,
  Blocks,
  CircleUser,
  CreditCard,
  Database,
  HardDrive,
  Keyboard,
  Lock,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { GeneralPanel } from "@/components/settings/panels/GeneralPanel";
import { Modal } from "@/components/ui/Modal";

type Tab = { id: string; label: string; icon: LucideIcon };

const TABS: Tab[] = [
  { id: "general", label: "General", icon: Settings2 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "personalization", label: "Personalization", icon: Sparkles },
  { id: "plugins", label: "Plugins", icon: Blocks },
  { id: "voice", label: "Voice", icon: AudioLines },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "data", label: "Data controls", icon: Database },
  { id: "storage", label: "Storage", icon: HardDrive },
  { id: "safety", label: "Safety", icon: ShieldCheck },
  { id: "security", label: "Security and login", icon: Lock },
  { id: "parental", label: "Parental controls", icon: Users },
  { id: "trusted", label: "Trusted contact", icon: UserRound },
  { id: "account", label: "Account", icon: CircleUser },
  { id: "keyboard", label: "Keyboard", icon: Keyboard },
];

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [active, setActive] = useState("general");
  const current = TABS.find((t) => t.id === active) ?? TABS[0];

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="settings-title"
      panelClassName="h-[600px] w-[680px] max-w-full overflow-hidden rounded-2xl"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close settings"
        className="absolute left-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-lg text-fg-secondary hover:bg-hover"
      >
        <X size={20} />
      </button>

      <div className="flex h-full">
        <nav className="flex w-[200px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-line-light p-2 pt-12">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActive(id)}
              className={`flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-sm ${
                active === id
                  ? "bg-selected font-medium text-fg"
                  : "text-fg-secondary hover:bg-hover"
              }`}
            >
              <Icon size={18} className="shrink-0 text-fg-secondary" />
              {label}
            </button>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="px-6 pb-3 pt-5">
            <h2 id="settings-title" className="text-lg font-medium text-fg">
              {current.label}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {active === "general" ? (
              <GeneralPanel />
            ) : (
              <p className="pt-2 text-sm text-fg-muted">
                {current.label} settings live here.
              </p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
