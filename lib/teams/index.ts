/**
 * Teams public surface -- the apply -> assemble -> team-accept loop (task 011).
 * Import via `@/lib/teams`. Server actions (`applyToProblem`, `acceptMembership`,
 * `contestRole`) are also importable from their own `"use server"` files so a
 * client component pulls only the action reference, never the loaders/admin code.
 */
export type {
  ActionResult,
  AssembleSummary,
  FeedProblemView,
  TeamInvitation,
  TeamMemberView,
} from "./types";
export { ROLE_LABELS, PROFILE_ROLES } from "./roles";
export { applyToProblem } from "./apply";
export { acceptMembership, contestRole } from "./accept";
export { assembleProblem, poolReady } from "./assemble";
export { collectUnmatched, widenGroupForRole } from "./unmatched";
export { loadAppliedProblemIds, loadInvitations } from "./data";
export type { AssembleResponse, WorkerTeam, WorkerMember } from "./worker";
