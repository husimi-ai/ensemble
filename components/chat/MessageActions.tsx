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
import type { SenderKind } from "@/lib/types";

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

type Props = {
  /** Who sent the message -- gates which actions apply (thumbs/regenerate = AI only). */
  senderKind: SenderKind;
  /** Whether the current user sent it -- gates edit (only your own message) and alignment. */
  isOwn: boolean;
  content: string;
};

/**
 * Actions that make sense in a multi-author room: copy is universal, edit is
 * only offered on your own message, thumbs/read-aloud/regenerate only apply
 * to the shared AI. System events carry no actions.
 */
export function MessageActions({ senderKind, isOwn, content }: Props) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const CopyIcon = copied ? Check : Copy;

  if (senderKind === "system") return null;

  if (senderKind === "ai") {
    // AI actions sit permanently below the message, not hover-revealed.
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

  // Human message: actions reveal on hover; only your own can be edited.
  return (
    <div
      className={`mt-1 flex gap-0.5 opacity-0 transition-opacity duration-100 group-hover:opacity-100 ${
        isOwn ? "justify-end" : "justify-start"
      }`}
    >
      <ActionButton icon={CopyIcon} label="Copy" onClick={copy} />
      {isOwn && <ActionButton icon={Pencil} label="Edit message" />}
    </div>
  );
}
