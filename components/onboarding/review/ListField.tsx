"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { SourceKind } from "@/lib/profile/schema";
import { SourceTag } from "./SourceTag";

/**
 * Editable, source-tagged list field (topics / skills / resources). Values show
 * as removable chips; a text input adds a new value on Enter. Any change flips
 * the field's provenance to "user" in the parent.
 */
export function ListField({
  label,
  values,
  onChange,
  source,
  confidence,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  source: SourceKind | null;
  confidence: number | null;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const v = draft.trim();
    if (!v || values.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...values, v]);
    setDraft("");
  }

  return (
    <div className="border-b border-line-light py-4">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-fg">{label}</span>
        <SourceTag source={source} confidence={confidence} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v, i) => (
          <span
            key={`${v}-${i}`}
            className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pl-2.5 pr-1 text-xs text-fg"
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((_, idx) => idx !== i))}
              className="grid h-4 w-4 place-items-center rounded-full text-fg-muted hover:bg-hover"
              aria-label={`Remove ${v}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <input
        value={draft}
        placeholder={placeholder ?? "Add and press Enter"}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        className="mt-2 h-9 w-full rounded-lg border border-line bg-elevated px-3 text-sm text-fg outline-none placeholder:text-fg-muted focus:border-line-heavy focus:ring-2 focus:ring-line-heavy"
      />
    </div>
  );
}
