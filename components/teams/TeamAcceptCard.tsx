"use client";

/**
 * Team-accept card (task 011, C10). Shows one proposed ensemble -- the problem,
 * every seat with its assigned role + accept state, and the unanimous-accept
 * progress -- and lets this member Accept their seat or Contest their assigned
 * role (which blocks activation and fires the 009 widen, C16). On unanimous
 * accept the group activates server-side and the founder is auto-added (C17).
 *
 * Design system: hairline cards, instant hovers, tokens only, light theme.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptMembership, contestRole } from "@/lib/teams/accept";
import { ROLE_LABELS } from "@/lib/teams/roles";
import type { TeamInvitation } from "@/lib/teams/types";
import { Card, Note, Pill, PrimaryButton, RoleBadge, SecondaryButton, TextArea } from "./parts";

export function TeamAcceptCard({ invitation }: { invitation: TeamInvitation }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contesting, setContesting] = useState(false);
  const [reason, setReason] = useState("");

  const { problem, members, selfRole, selfAccepted, acceptedCount, totalCount } = invitation;

  function run(action: () => Promise<{ ok: true; note?: string } | { error: string }>) {
    setNote(null);
    setError(null);
    startTransition(async () => {
      const res = await action();
      if ("error" in res) setError(res.error);
      else {
        setNote(res.note ?? "Done.");
        setContesting(false);
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Pill>Proposed ensemble</Pill>
        {problem.subfield ? <Pill>{problem.subfield}</Pill> : null}
        <span className="ml-auto text-xs text-fg-muted">
          {acceptedCount}/{totalCount} accepted
        </span>
      </div>

      <h3 className="text-base font-semibold text-fg">{problem.title}</h3>
      {problem.description ? (
        <p className="mt-1 line-clamp-3 text-sm text-fg-secondary">{problem.description}</p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2">
        <span className="text-xs font-medium text-fg-secondary">The team</span>
        {members.map((m) => (
          <div
            key={m.userId}
            className="flex items-center gap-2 rounded-[10px] border border-line-light px-3 py-2"
          >
            <span className="text-sm text-fg">{m.isSelf ? "You" : "Member"}</span>
            <RoleBadge label={ROLE_LABELS[m.role]} accepted={m.accepted} />
            <span className="ml-auto text-xs text-fg-muted">
              {m.accepted ? "accepted" : "pending"}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-fg-muted">
        Your seat: <span className="font-medium text-fg-secondary">{ROLE_LABELS[selfRole]}</span>.
        Every member must accept before the room opens.
      </p>

      {contesting ? (
        <div className="mt-3 flex flex-col gap-2">
          <TextArea
            value={reason}
            onChange={setReason}
            placeholder="Why isn't this the right role for you?"
          />
          <div className="flex items-center gap-2">
            <PrimaryButton
              onClick={() => run(() => contestRole({ groupId: invitation.groupId, reason }))}
              disabled={pending}
            >
              {pending ? "Submitting…" : "Submit contest"}
            </PrimaryButton>
            <SecondaryButton onClick={() => setContesting(false)} disabled={pending}>
              Cancel
            </SecondaryButton>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <PrimaryButton
            onClick={() => run(() => acceptMembership(invitation.groupId))}
            disabled={pending || selfAccepted}
          >
            {selfAccepted ? "Accepted" : pending ? "Accepting…" : "Accept my seat"}
          </PrimaryButton>
          <SecondaryButton onClick={() => setContesting(true)} disabled={pending} danger>
            Contest role
          </SecondaryButton>
          <Note note={note} error={error} />
        </div>
      )}
    </Card>
  );
}
