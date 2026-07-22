"use client";

/**
 * Operator console shell -- the founder-only tabbed queue (Problems / Requests /
 * Versions). Server (`app/(app)/operator/page.tsx`) loads the queues and passes
 * them in; this only owns the active-tab state. Tabs snap (no `transition-colors`),
 * light theme, tokens only.
 */
import { useState } from "react";
import type { OperatorQueues } from "@/lib/operator/data";
import { ProblemReview } from "./ProblemReview";
import { RequestQueue } from "./RequestQueue";
import { VersionReview } from "./VersionReview";

type Tab = "problems" | "requests" | "versions";

export function OperatorConsole({ queues }: { queues: OperatorQueues }) {
  const [tab, setTab] = useState<Tab>("problems");

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "problems", label: "Problems", count: queues.problems.length },
    { id: "requests", label: "Requests", count: queues.requests.length },
    { id: "versions", label: "Versions", count: queues.versions.length },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 border-b border-line-light">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.id
                ? "border-fg text-fg"
                : "border-transparent text-fg-secondary hover:text-fg"
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-fg-muted">{t.count}</span>
          </button>
        ))}
      </div>

      {tab === "problems" ? <ProblemReview problems={queues.problems} /> : null}
      {tab === "requests" ? <RequestQueue requests={queues.requests} /> : null}
      {tab === "versions" ? <VersionReview versions={queues.versions} /> : null}
    </div>
  );
}
