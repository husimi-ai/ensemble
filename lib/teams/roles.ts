/**
 * Role vocabulary bridge. The assembly worker (task 010) and `applications.role`
 * speak `profile_role` ('problem_identifier' | 'builder' | 'researcher'); the
 * `memberships.role` enum uses the domain labels ('problem' | 'builder' |
 * 'researcher' | 'provider' | 'founder'). This module is the single place those
 * two vocabularies are mapped, plus human labels for the accept screen.
 */
import type { MembershipRole } from "@/lib/types";

/** The three assemblable roles, as the worker + `applications.role` emit them. */
export const PROFILE_ROLES = ["problem_identifier", "builder", "researcher"] as const;

/** `profile_role` (worker/application) -> `membership_role` (stored on a seat). */
const PROFILE_TO_MEMBERSHIP: Record<string, MembershipRole> = {
  problem_identifier: "problem",
  builder: "builder",
  researcher: "researcher",
};

/** `membership_role` -> the `profile_role` the 009 specialist matcher filters on. */
const MEMBERSHIP_TO_PROFILE: Partial<Record<MembershipRole, string>> = {
  problem: "problem_identifier",
  builder: "builder",
  researcher: "researcher",
};

/**
 * Map a worker/application `profile_role` to the seat's `membership_role`. The
 * worker only ever emits the three known roles, so the fallback is defensive.
 */
export function toMembershipRole(profileRole: string): MembershipRole {
  return PROFILE_TO_MEMBERSHIP[profileRole] ?? "builder";
}

/** Map a seat's `membership_role` back to a 009 `role` filter, or null. */
export function toProfileRole(role: MembershipRole): string | null {
  return MEMBERSHIP_TO_PROFILE[role] ?? null;
}

/** Human-readable label for a seat role (accept screen / feed). */
export const ROLE_LABELS: Record<MembershipRole, string> = {
  problem: "Problem identifier",
  builder: "Builder",
  researcher: "Researcher",
  provider: "Provider",
  founder: "Founder",
};
