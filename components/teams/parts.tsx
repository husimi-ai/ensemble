"use client";

/**
 * On-token building blocks for the teams surfaces (feed apply cards + the
 * team-accept screen). Same design-system idioms as `components/operator/parts`
 * (hairline `border-line` cards, `rounded-[10px]` fields, instant hovers -- no
 * `transition-colors`, light theme, tokens only), scoped to `components/teams`.
 */
import { type ReactNode } from "react";

/** Elevated, hairline-bordered card. */
export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-elevated p-4 shadow-card">
      {children}
    </div>
  );
}

/** Small uppercase status/meta pill. */
export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-fg-secondary">
      {children}
    </span>
  );
}

/** Role chip on a seat (accepted seats read as accent). */
export function RoleBadge({ label, accepted }: { label: string; accepted?: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        accepted ? "bg-accent/10 text-accent" : "bg-muted text-fg-secondary"
      }`}
    >
      {label}
    </span>
  );
}

/** Dark primary CTA (apply / accept). */
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

/** Bordered secondary button (contest / cancel). */
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

/** Multi-line reason field (role-contest). */
export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 2,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full resize-y rounded-[10px] border border-line bg-elevated px-3 py-2 text-sm leading-6 text-fg outline-none placeholder:text-fg-muted focus:border-line-heavy focus:ring-2 focus:ring-line-heavy"
    />
  );
}

/** Inline result note (error red, success muted). */
export function Note({ note, error }: { note?: string | null; error?: string | null }) {
  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (note) return <p className="text-sm text-fg-secondary">{note}</p>;
  return null;
}
