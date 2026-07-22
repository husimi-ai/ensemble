"use client";

import { useState } from "react";

const SOURCES = [
  "OpenAlex (open scholarly works, CC0)",
  "ORCID (public researcher record)",
  "Europe PMC (biomedical literature + MeSH)",
  "Crossref (DOI / funding metadata)",
  "The CV and links you provide",
];

const RIGHTS = [
  "Access and review every field before it is saved",
  "Rectify anything wrong on the screen that follows",
  "Object to, restrict, or erase your profile at any time",
];

/**
 * GDPR Article 14 transparency notice. Data about you is assembled from open
 * third-party sources, so we tell you which sources, why (matching), and what
 * rights you hold — shown at collection and again on the review screen.
 * Presentational; tokens only; hovers snap.
 */
export function Art14Notice({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(!compact);

  return (
    <div className="rounded-lg border border-line bg-subtle p-4 text-sm text-fg-secondary">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-fg">How we build your profile</p>
        {compact && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-md px-2 py-1 text-xs text-fg-secondary hover:bg-hover"
          >
            {open ? "Hide" : "Details"}
          </button>
        )}
      </div>
      <p className="mt-1 leading-6">
        Ensemble assembles a draft profile from open scholarly sources plus what
        you give us, so we can match you to research problems and teams. You are
        always shown the result and can correct or remove it.
      </p>

      {open && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <NoticeList title="Sources we read" items={SOURCES} />
          <NoticeList title="Your rights (GDPR Art. 14 / 16)" items={RIGHTS} />
          <p className="text-xs leading-5 text-fg-muted sm:col-span-2">
            Purpose: matching only. Legal basis: your consent, given by continuing.
            We never scrape LinkedIn, buy person-datasets, or infer health data
            about you. Controller: Ensemble — privacy@ensemble.studio.
          </p>
        </div>
      )}
    </div>
  );
}

function NoticeList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">
        {title}
      </p>
      <ul className="mt-1.5 space-y-1">
        {items.map((it) => (
          <li key={it} className="flex gap-2 leading-6">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-fg-muted" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
