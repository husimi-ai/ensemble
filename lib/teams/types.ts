/**
 * Shared TS shapes for the apply -> assemble -> team-accept loop (task 011).
 * Import via `@/lib/teams`. Kept separate so the server modules and the
 * `components/teams/*` client surfaces agree on one contract.
 */
import type { GroupStatus, MembershipRole } from "@/lib/types";

/** Discriminated result every teams server action returns (mirrors operator's). */
export type ActionResult = { ok: true; note?: string } | { error: string };

/** Outcome of an assembly trigger (route / schedule) over one problem's pool. */
export interface AssembleSummary {
  /** `NOT_READY` = pool precheck failed, worker not called. */
  status: "OK" | "INFEASIBLE" | "NOT_READY";
  groupsCreated: number;
  membersPlaced: number;
  /** Roles no applicant could fill (the widen signal), when INFEASIBLE. */
  missingRoles: string[];
  /** Applicants moved to `unmatched` (the C16 waitlist), when INFEASIBLE. */
  unmatched: number;
}

/** A problem as rendered in the feed apply list (a thin slice of `ProblemMatch`). */
export interface FeedProblemView {
  id: string;
  title: string;
  description: string;
  subfield: string | null;
  tags: string[];
  fit: number;
  proximity: number;
  score: number;
  /** True when the signed-in user already has an application on this problem. */
  applied: boolean;
}

/** One co-member on a proposed team (name is self-only under RLS, like rooms). */
export interface TeamMemberView {
  userId: string;
  role: MembershipRole;
  accepted: boolean;
  isSelf: boolean;
  name: string | null;
}

/** A proposed team awaiting this user's accept/contest (the invitations screen). */
export interface TeamInvitation {
  groupId: string;
  groupTitle: string | null;
  status: GroupStatus;
  problem: {
    id: string;
    title: string;
    description: string;
    subfield: string | null;
  };
  members: TeamMemberView[];
  selfRole: MembershipRole;
  selfAccepted: boolean;
  acceptedCount: number;
  totalCount: number;
}
