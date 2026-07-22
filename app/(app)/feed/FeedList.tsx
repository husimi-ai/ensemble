"use client";

/**
 * Feed apply list (task 011). The server ranks problems (009 matching engine) and
 * passes them in; this owns only the per-card apply interaction. Applying creates
 * an `applications` row (the pre-assembly step) via the `applyToProblem` action.
 * Ranking, scoring, and fetching stay server-side -- this is just the CTA.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyToProblem } from "@/lib/teams/apply";
import type { FeedProblemView } from "@/lib/teams/types";
import { Card, Note, Pill, PrimaryButton } from "@/components/teams/parts";

export function FeedList({ items }: { items: FeedProblemView[] }) {
  if (!items.length) {
    return (
      <p className="text-sm text-fg-muted">
        No matched problems yet. Finish your profile so we can rank the feed.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {items.map((p) => (
        <ProblemCard key={p.id} problem={p} />
      ))}
    </div>
  );
}

function ProblemCard({ problem }: { problem: FeedProblemView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [applied, setApplied] = useState(problem.applied);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onApply() {
    setNote(null);
    setError(null);
    startTransition(async () => {
      const res = await applyToProblem(problem.id);
      if ("error" in res) setError(res.error);
      else {
        setApplied(true);
        setNote(res.note ?? "Applied.");
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {problem.subfield ? <Pill>{problem.subfield}</Pill> : null}
        {problem.tags.slice(0, 3).map((t) => (
          <Pill key={t}>{t}</Pill>
        ))}
        <span className="ml-auto text-xs text-fg-muted">
          fit {problem.fit.toFixed(2)} · prox {problem.proximity.toFixed(2)}
        </span>
      </div>

      <h3 className="text-base font-semibold text-fg">{problem.title}</h3>
      {problem.description ? (
        <p className="mt-1 line-clamp-3 text-sm text-fg-secondary">{problem.description}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <PrimaryButton onClick={onApply} disabled={pending || applied}>
          {applied ? "Applied" : pending ? "Applying…" : "Apply"}
        </PrimaryButton>
        <Note note={note} error={error} />
      </div>
    </Card>
  );
}
