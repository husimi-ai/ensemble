"use client";

/**
 * Shared building blocks for the operator console cards. Kept on-token (design
 * system §3/§5): hairline `border-line` cards, `rounded-[10px]` fields, instant
 * hovers (no `transition-colors`), light theme only. Reused by ProblemReview,
 * RequestQueue, VersionReview so each stays under the file cap.
 */
import { type ReactNode } from "react";

/** A queue item card: hairline border, elevated surface, comfortable padding. */
export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-elevated p-4 shadow-card">
      {children}
    </div>
  );
}

/** Section wrapper: heading + count + the list (or an empty note). */
export function Queue({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-fg">
        {title} <span className="ml-1 text-fg-muted">{count}</span>
      </h3>
      {count === 0 ? (
        <p className="text-sm text-fg-muted">Nothing in this queue.</p>
      ) : (
        <div className="flex flex-col gap-3">{children}</div>
      )}
    </section>
  );
}

/** Small uppercase status/kind pill. */
export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-fg-secondary">
      {children}
    </span>
  );
}

const inputBase =
  "w-full rounded-[10px] border border-line bg-elevated px-3 py-2 text-sm text-fg outline-none placeholder:text-fg-muted focus:border-line-heavy focus:ring-2 focus:ring-line-heavy";

/** Labeled single-line text field. */
export function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-fg-secondary">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputBase}
      />
    </label>
  );
}

/** Labeled multi-line text field. */
export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-fg-secondary">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`${inputBase} resize-y leading-6`}
      />
    </label>
  );
}

/** Comma-separated list field (tags / roles / skills) surfaced as a string. */
export function ListField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return <Field label={label} value={value} onChange={onChange} placeholder={placeholder} />;
}

/** Parse a comma/newline separated field into a trimmed, de-duped list. */
export function parseList(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(/[,\n]/)) {
    const t = part.trim();
    if (t) seen.add(t);
  }
  return [...seen];
}

/** Dark primary button (send / publish CTA). */
export function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-fg-inverted hover:bg-primary-hover disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/** Bordered secondary button (fulfil / feedback). */
export function SecondaryButton({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-9 rounded-lg border border-line px-4 text-sm font-medium hover:bg-hover disabled:opacity-50 ${
        danger ? "text-danger" : "text-fg"
      }`}
    >
      {children}
    </button>
  );
}

/** Inline result note (error red, success muted). */
export function Note({ note, error }: { note?: string | null; error?: string | null }) {
  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (note) return <p className="text-sm text-fg-secondary">{note}</p>;
  return null;
}
