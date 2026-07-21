"use client";

import { Globe, Image as ImageIcon, PenLine, type LucideIcon } from "lucide-react";

const ITEMS: { icon: LucideIcon; label: string }[] = [
  { icon: ImageIcon, label: "Create an image" },
  { icon: PenLine, label: "Write or edit" },
  { icon: Globe, label: "Look something up" },
];

export function Suggestions() {
  return (
    <div className="mx-auto flex w-full max-w-thread flex-col">
      {ITEMS.map(({ icon: Icon, label }) => (
        <button
          key={label}
          type="button"
          className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-fg-secondary hover:bg-hover"
        >
          <Icon size={18} className="text-fg-muted" />
          {label}
        </button>
      ))}
    </div>
  );
}
