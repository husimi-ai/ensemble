import { MailCheck } from "lucide-react";
import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";
import { TeamAcceptCard } from "@/components/teams/TeamAcceptCard";
import { requireUser } from "@/lib/auth";
import { loadInvitations } from "@/lib/teams";

export const metadata: Metadata = { title: "Invitations · Ensemble" };

// Proposed teams change as members accept; always load live (never cache).
export const dynamic = "force-dynamic";

/**
 * Team-accept screen (task 011, C10). Lists every proposed ensemble the user has
 * a seat on: the problem, the roster with each assigned role, and Accept / Contest
 * controls. Unanimous accept activates the group + auto-adds the founder (C17),
 * which the room (012) then renders.
 */
export default async function InvitationsPage() {
  await requireUser();
  const invitations = await loadInvitations();

  return (
    <PagePlaceholder
      icon={MailCheck}
      title="Team invitations"
      description="Ensembles we've proposed for you. Every member must accept before the room opens; contest your role if it isn't the right fit."
    >
      {invitations.length === 0 ? (
        <p className="text-sm text-fg-muted">
          No pending invitations. Apply to problems in the feed and we'll assemble a team
          when the pool is ready.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {invitations.map((inv) => (
            <TeamAcceptCard key={inv.groupId} invitation={inv} />
          ))}
        </div>
      )}
    </PagePlaceholder>
  );
}
