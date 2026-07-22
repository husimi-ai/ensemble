"use client";

import type { SourceKind } from "@/lib/profile/schema";
import { SourceTag } from "./SourceTag";

/**
 * One editable, source-tagged field on the show-and-correct screen. Single-value
 * fields (text / textarea / number); list and publication fields have their own
 * components. Editing here is what the parent flips to "user" provenance.
 */
export function EditableField({
  label,
  value,
  onChange,
  source,
  confidence,
  multiline = false,
  numeric = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  source: SourceKind | null;
  confidence: number | null;
  multiline?: boolean;
  numeric?: boolean;
  placeholder?: string;
}) {
  const inputClass =
    "w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-fg outline-none placeholder:text-fg-muted focus:border-line-heavy focus:ring-2 focus:ring-line-heavy";

  return (
    <div className="border-b border-line-light py-4">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-fg">{label}</span>
        <SourceTag source={source} confidence={confidence} />
      </div>
      {multiline ? (
        <textarea
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={`${inputClass} resize-y leading-6`}
        />
      ) : (
        <input
          type={numeric ? "number" : "text"}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      )}
    </div>
  );
}
