"use client";

/**
 * 32x20 switch. Matches the reference exactly: 16px white knob, no shadow, 2px
 * inset, 12px travel. Only the knob animates — 0.1s cubic-bezier(0.4,0,0.2,1)
 * (Tailwind ease-in-out); the track color snaps instantly, as in the reference.
 */
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-8 shrink-0 rounded-full ${
        checked ? "bg-accent" : "bg-[var(--knob-off)]"
      }`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-100 ease-in-out ${
          checked ? "translate-x-3" : "translate-x-0"
        }`}
      />
    </button>
  );
}
