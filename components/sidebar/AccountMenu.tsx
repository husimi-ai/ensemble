"use client";

import { LogOut, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { useSession } from "@/app/providers";
import { signOut } from "@/lib/auth/actions";

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
};

/**
 * Popover anchored above the account row: identity header, Profile, Settings
 * (opens the modal), and Log out (a server action). Reads the session; no
 * hardcoded account data.
 */
export function AccountMenu({ open, onClose, onOpenSettings }: Props) {
  const session = useSession();
  if (!open) return null;

  const name = session?.name?.trim() || "You";
  const email = session?.email ?? "";
  const initial = (name[0] ?? "?").toUpperCase();

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="pop-in absolute bottom-[calc(100%+8px)] left-2 right-2 z-50 rounded-2xl border border-line-light bg-elevated p-1.5 shadow-pop">
        <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-muted text-xs font-medium text-fg-secondary">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-fg">{name}</div>
            {email ? <div className="truncate text-xs text-fg-muted">{email}</div> : null}
          </div>
        </div>

        <Divider />
        <Link
          href="/profile"
          onClick={onClose}
          className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-sm text-fg hover:bg-hover"
        >
          <UserRound size={18} className="text-fg-secondary" />
          <span className="flex-1 text-left">Profile</span>
        </Link>
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenSettings();
          }}
          className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-sm text-fg hover:bg-hover"
        >
          <Settings size={18} className="text-fg-secondary" />
          <span className="flex-1 text-left">Settings</span>
        </button>

        <Divider />
        <form action={signOut}>
          <button
            type="submit"
            onClick={onClose}
            className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-sm text-fg hover:bg-hover"
          >
            <LogOut size={18} className="text-fg-secondary" />
            <span className="flex-1 text-left">Log out</span>
          </button>
        </form>
      </div>
    </>
  );
}

function Divider() {
  return <div className="my-1 border-t border-line-light" />;
}
