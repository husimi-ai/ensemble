"use client";

import type { SourceKind } from "@/lib/profile/schema";

const LABELS: Record<SourceKind, string> = {
  openalex: "OpenAlex",
  orcid: "ORCID",
  europepmc: "Europe PMC",
  crossref: "Crossref",
  cv: "Your CV",
  user: "You",
};

/**
 * Per-field provenance badge for the show-and-correct screen (GDPR Art. 14):
 * where the value came from, and the extraction confidence when known. A value
 * the user edits flips to "You" at full confidence.
 */
export function SourceTag({
  source,
  confidence,
}: {
  source: SourceKind | null;
  confidence: number | null;
}) {
  if (!source) {
    return (
      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-fg-muted">
        No source
      </span>
    );
  }
  const pct = confidence != null ? `${Math.round(confidence * 100)}%` : null;
  const isUser = source === "user";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] ${
        isUser ? "bg-accent/10 text-accent" : "bg-muted text-fg-secondary"
      }`}
    >
      {LABELS[source]}
      {pct && !isUser ? <span className="text-fg-muted">· {pct}</span> : null}
    </span>
  );
}
