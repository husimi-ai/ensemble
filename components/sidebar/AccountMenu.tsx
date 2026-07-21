"use client";

import {
  ChevronRight,
  Gem,
  HelpCircle,
  LogOut,
  Settings,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
};

export function AccountMenu({ open, onClose, onOpenSettings }: Props) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="pop-in absolute bottom-[calc(100%+8px)] left-2 right-2 z-50 rounded-2xl border border-line-light bg-elevated p-1.5 shadow-pop">
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-hover"
        >
          <div className="grid h-8 w-8 place-items-center rounded-full bg-muted text-xs font-medium text-fg-secondary">
            M
          </div>
          <div className="min-w-0 flex-1 text-left">
            <div className="truncate text-sm font-medium text-fg">Moussa Ouallaf</div>
            <div className="truncate text-xs text-fg-muted">Free</div>
          </div>
          <ChevronRight size={16} className="text-fg-muted" />
        </button>

        <Divider />
        <Item icon={Gem} label="Upgrade plan" />
        <Item icon={Sparkles} label="Personalization" />
        <Item icon={UserRound} label="Profile" />
        <Item
          icon={Settings}
          label="Settings"
          onClick={() => {
            onClose();
            onOpenSettings();
          }}
        />
        <Divider />
        <Item icon={HelpCircle} label="Help" trailing={<ChevronRight size={16} className="text-fg-muted" />} />
        <Item icon={LogOut} label="Log out" />
      </div>
    </>
  );
}

function Divider() {
  return <div className="my-1 border-t border-line-light" />;
}

function Item({
  icon: Icon,
  label,
  onClick,
  trailing,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-sm text-fg hover:bg-hover"
    >
      <Icon size={18} className="text-fg-secondary" />
      <span className="flex-1 text-left">{label}</span>
      {trailing}
    </button>
  );
}
