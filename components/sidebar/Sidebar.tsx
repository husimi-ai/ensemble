"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "@/app/providers";
import { IconPanelToggle } from "@/components/icons";
import { NavLink } from "@/components/nav/NavLink";
import { PRIMARY_NAV } from "@/components/nav/navConfig";
import { AccountMenu } from "@/components/sidebar/AccountMenu";
import { IconButton } from "@/components/ui/IconButton";

type Props = {
  rooms?: RoomSummary[];
  onCollapse: () => void;
  onOpenSettings: () => void;
};

/**
 * Ensemble's left navigation: brand + collapse, the primary destinations
 * (Operator only for the founder), the user's rooms, and the account button.
 * Keeps the reference row geometry + tokens; no hardcoded account/chat data.
 */
export function Sidebar({ rooms = [], onCollapse, onOpenSettings }: Props) {
  const session = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  const items = PRIMARY_NAV.filter((n) => !n.founderOnly || session?.isFounder);
  const name = session?.name?.trim() || "You";
  const subtitle = session?.isFounder ? "Founder" : "Member";
  const initial = (name[0] ?? "?").toUpperCase();

  return (
    <aside className="flex h-full w-sidebar shrink-0 flex-col bg-sidebar">
      {/* brand + collapse */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <Link
          href="/feed"
          aria-label="Ensemble home"
          className="grid h-8 w-8 place-items-center rounded-full bg-primary text-sm font-semibold text-fg-inverted"
        >
          E
        </Link>
        <IconButton label="Collapse sidebar" onClick={onCollapse}>
          <IconPanelToggle size={20} />
        </IconButton>
      </div>

      {/* nav + ensembles */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <nav className="flex flex-col gap-0.5">
          {items.map((n) => (
            <NavLink key={n.href} href={n.href} label={n.label} icon={n.icon} />
          ))}
        </nav>

        <div className="mt-4">
          <div className="px-2.5 pb-1 pt-2 text-sm font-semibold text-fg">My Ensembles</div>
          <p className="px-2.5 py-1.5 text-sm text-fg-muted">
            Rooms you join will appear here.
          </p>
        </div>
      </div>

      {/* account */}
      <div className="relative p-2">
        <AccountMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          onOpenSettings={onOpenSettings}
        />
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex w-full items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-left hover:bg-hover"
        >
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium text-fg-secondary">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-fg">{name}</div>
            <div className="truncate text-xs text-fg-muted">{subtitle}</div>
          </div>
        </button>
      </div>
    </aside>
  );
}
