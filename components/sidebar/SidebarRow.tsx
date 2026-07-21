"use client";

import {
  Archive,
  MoreHorizontal,
  Pencil,
  Share2,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import { useState } from "react";

type IconCmp = ComponentType<{ size?: number; className?: string }>;

type Props = {
  label: string;
  icon?: IconCmp;
  iconClassName?: string;
  active?: boolean;
};

/** A sidebar list row (project or chat) with a hover-revealed "…" actions menu. */
export function SidebarRow({ label, icon: Icon, iconClassName, active }: Props) {
  const [menu, setMenu] = useState(false);

  return (
    <div className="group relative">
      <button
        type="button"
        className={`flex min-h-9 w-full items-center gap-2 rounded-[10px] py-1.5 pl-2.5 pr-9 text-sm text-fg hover:bg-hover ${
          active ? "bg-muted" : ""
        }`}
      >
        {Icon && (
          <Icon size={18} className={`shrink-0 ${iconClassName ?? "text-fg-secondary"}`} />
        )}
        <span className="truncate">{label}</span>
      </button>

      <button
        type="button"
        aria-label="Open conversation options"
        onClick={() => setMenu((v) => !v)}
        className={`absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-fg-secondary hover:bg-[rgba(0,0,0,0.08)] ${
          menu ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        <MoreHorizontal size={18} />
      </button>

      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
          <div className="pop-in absolute right-1 top-full z-50 w-48 rounded-xl border border-line-light bg-elevated p-1.5 shadow-pop">
            <MenuItem icon={Share2} label="Share" />
            <MenuItem icon={Pencil} label="Rename" />
            <MenuItem icon={Archive} label="Archive" />
            <MenuItem icon={Trash2} label="Delete" danger />
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-hover ${
        danger ? "text-danger" : "text-fg"
      }`}
    >
      <Icon size={16} className={danger ? "" : "text-fg-secondary"} />
      {label}
    </button>
  );
}
