"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export function SettingRow({
  title,
  description,
  control,
  divider = true,
}: {
  title: string;
  description?: string;
  control: ReactNode;
  divider?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 py-4 ${
        divider ? "border-b border-line-light" : ""
      }`}
    >
      <div className="min-w-0">
        <div className="text-sm text-fg">{title}</div>
        {description && <div className="mt-1 text-xs leading-5 text-fg-muted">{description}</div>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

/** A dropdown-styled value button (label + chevron), matching the reference rows. */
export function SelectControl({ value, dot }: { value: string; dot?: boolean }) {
  return (
    <button
      type="button"
      className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-fg hover:bg-hover"
    >
      {dot && <span className="h-3 w-3 rounded-full bg-fg-muted" />}
      {value}
      <ChevronDown size={16} className="text-fg-muted" />
    </button>
  );
}
