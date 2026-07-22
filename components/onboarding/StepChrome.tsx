"use client";

/**
 * Small presentational helpers shared by the wizard steps: a step header, a
 * labeled text field, and the back/next footer. Tokens only; hovers snap. Kept
 * here so each step file stays focused on its own orchestration.
 */

export function StepHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-semibold text-fg">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-fg-secondary">{description}</p>
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-fg">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-lg border border-line bg-elevated px-3 text-sm text-fg outline-none placeholder:text-fg-muted focus:border-line-heavy focus:ring-2 focus:ring-line-heavy"
      />
      {hint ? <span className="text-xs text-fg-muted">{hint}</span> : null}
    </label>
  );
}

export function WizardNav({
  onBack,
  onNext,
  nextLabel = "Continue",
  nextDisabled = false,
  busy = false,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  busy?: boolean;
}) {
  return (
    <div className="mt-8 flex items-center justify-between gap-3">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="h-11 rounded-lg px-4 text-sm font-medium text-fg-secondary hover:bg-hover"
        >
          Back
        </button>
      ) : (
        <span />
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled || busy}
        className="h-11 rounded-lg bg-primary px-5 text-sm font-medium text-fg-inverted hover:bg-primary-hover disabled:opacity-60"
      >
        {busy ? "Working…" : nextLabel}
      </button>
    </div>
  );
}
