"use client";

import {
  Check,
  Copy,
  Pencil,
  RefreshCcw,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import type { Role } from "@/lib/types";

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-lg text-fg-secondary hover:bg-hover"
    >
      <Icon size={16} />
    </button>
  );
}

export function MessageActions({ role, content }: { role: Role; content: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const CopyIcon = copied ? Check : Copy;

  // User actions reveal on hover; assistant actions sit permanently below.
  if (role === "user") {
    return (
      <div className="mt-1 flex justify-end gap-0.5 opacity-0 transition-opacity duration-100 group-hover:opacity-100">
        <ActionButton icon={CopyIcon} label="Copy" onClick={copy} />
        <ActionButton icon={Pencil} label="Edit message" />
      </div>
    );
  }

  return (
    <div className="mt-1 flex gap-0.5">
      <ActionButton icon={CopyIcon} label="Copy" onClick={copy} />
      <ActionButton icon={ThumbsUp} label="Good response" />
      <ActionButton icon={ThumbsDown} label="Bad response" />
      <ActionButton icon={Volume2} label="Read aloud" />
      <ActionButton icon={RefreshCcw} label="Regenerate" />
    </div>
  );
}
