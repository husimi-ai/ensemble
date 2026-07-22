"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Check, FileStack, Loader2, RotateCw } from "lucide-react";
import { resolveCandidates } from "@/lib/onboarding/client";
import type { ScholarlyAuthorHit } from "@/lib/scholarly";
import type { StepProps } from "./types";
import { StepHeader, WizardNav } from "./StepChrome";

const NONE = "__none__";
const keyOf = (h: ScholarlyAuthorHit) => h.orcid ?? `${h.source}:${h.id}`;

/**
 * Step 3 — "Is this you?" disambiguation. Calls /resolve for candidate authors
 * and lets the user confirm exactly one (or none). The confirmed pick is both
 * the accuracy anchor and the GDPR consent signal that drives /ingest.
 */
export function IsThisYouStep({ data, patch, onNext, onBack }: StepProps) {
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<ScholarlyAuthorHit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(
    data.picked ? keyOf(data.picked) : null,
  );

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await resolveCandidates({
        name: data.name,
        institution: data.institution || null,
        orcid: data.orcid || null,
      });
      setCandidates(res.candidates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not search right now.");
    } finally {
      setLoading(false);
    }
  }, [data.name, data.institution, data.orcid]);

  useEffect(() => {
    void run();
  }, [run]);

  function pick(hit: ScholarlyAuthorHit) {
    setSelected(keyOf(hit));
    patch({ picked: hit, authorId: hit.source === "openalex" ? hit.id : null });
  }
  function pickNone() {
    setSelected(NONE);
    patch({ picked: null, authorId: null });
  }

  return (
    <div>
      <StepHeader
        title="Is this you?"
        description="Pick the record that matches you. Your choice confirms who we build the profile from — nothing is saved yet."
      />

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-fg-secondary">
          <Loader2 size={18} className="animate-spin" />
          Searching the open scholarly record…
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          {candidates.map((hit) => (
            <CandidateCard
              key={keyOf(hit)}
              hit={hit}
              selected={selected === keyOf(hit)}
              onSelect={() => pick(hit)}
            />
          ))}
          <button
            type="button"
            onClick={pickNone}
            className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm hover:bg-hover ${
              selected === NONE ? "border-accent bg-selected" : "border-line"
            }`}
          >
            <span className="text-fg">
              None of these — continue without a match
            </span>
            {selected === NONE ? <Check size={16} className="text-accent" /> : null}
          </button>

          <button
            type="button"
            onClick={() => void run()}
            className="mt-1 flex w-fit items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-fg-secondary hover:bg-hover"
          >
            <RotateCw size={15} />
            Search again
          </button>
        </div>
      )}

      <WizardNav
        onBack={onBack}
        onNext={onNext}
        nextLabel="Build my profile"
        nextDisabled={loading || selected === null}
      />
    </div>
  );
}

function CandidateCard({
  hit,
  selected,
  onSelect,
}: {
  hit: ScholarlyAuthorHit;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left hover:bg-hover ${
        selected ? "border-accent bg-selected" : "border-line"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-fg">{hit.name}</span>
          {hit.orcid ? (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-fg-secondary">
              ORCID
            </span>
          ) : null}
        </div>
        {hit.institution ? (
          <div className="mt-1 flex items-center gap-1.5 text-xs text-fg-secondary">
            <Building2 size={13} className="shrink-0" />
            <span className="truncate">{hit.institution}</span>
          </div>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
          {hit.worksCount != null ? (
            <span className="flex items-center gap-1">
              <FileStack size={13} />
              {hit.worksCount} works
            </span>
          ) : null}
          {hit.topics.slice(0, 3).map((t) => (
            <span key={t} className="truncate">
              {t}
            </span>
          ))}
        </div>
      </div>
      {selected ? (
        <Check size={18} className="mt-0.5 shrink-0 text-accent" />
      ) : null}
    </button>
  );
}
