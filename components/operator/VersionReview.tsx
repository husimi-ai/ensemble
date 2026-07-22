"use client";

/**
 * Operator queue -- submitted versions (paper + codebase). The founder reads the
 * refs, writes feedback, and either sends it back for another iteration
 * (`feedback`) or takes it over to co-author toward publication (`taken_over`)
 * via the `reviewVersion` action (C13/C14).
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewVersion } from "@/lib/operator/actions";
import type { OperatorVersion } from "@/lib/operator/data";
import {
  Card,
  Note,
  Pill,
  PrimaryButton,
  Queue,
  SecondaryButton,
  TextArea,
} from "./parts";

export function VersionReview({ versions }: { versions: OperatorVersion[] }) {
  return (
    <Queue title="Submitted versions" count={versions.length}>
      {versions.map((v) => (
        <VersionCard key={v.id} version={v} />
      ))}
    </Queue>
  );
}

function VersionCard({ version }: { version: OperatorVersion }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState(version.feedback ?? "");

  function submit(status: "feedback" | "taken_over") {
    setNote(null);
    setError(null);
    startTransition(async () => {
      const res = await reviewVersion({ id: version.id, feedback, status });
      if ("error" in res) setError(res.error);
      else {
        setNote(res.note ?? "Saved.");
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <div className="mb-2 flex items-center gap-2">
        <Pill>v{version.versionNo}</Pill>
        <Pill>{version.status}</Pill>
        {version.groupName ? (
          <span className="text-xs text-fg-muted">{version.groupName}</span>
        ) : null}
      </div>
      <dl className="mb-3 grid gap-1 text-sm">
        <Ref label="Paper" value={version.paperRef} />
        <Ref label="Repo" value={version.repoRef} />
      </dl>
      <TextArea label="Feedback" value={feedback} onChange={setFeedback} rows={3} />
      <div className="mt-3 flex items-center gap-3">
        <SecondaryButton onClick={() => submit("feedback")} disabled={pending}>
          {pending ? "Saving…" : "Send feedback"}
        </SecondaryButton>
        <PrimaryButton onClick={() => submit("taken_over")} disabled={pending}>
          Take over
        </PrimaryButton>
        <Note note={note} error={error} />
      </div>
    </Card>
  );
}

function Ref({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="w-14 shrink-0 text-fg-muted">{label}</dt>
      <dd className="min-w-0 break-all text-fg">
        {value ?? <span className="text-fg-muted">—</span>}
      </dd>
    </div>
  );
}
