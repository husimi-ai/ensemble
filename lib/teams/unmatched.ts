/**
 * The unmatched / widen path (C16 + T4 widen). Two moves:
 *   - {@link collectUnmatched}: when the worker returns INFEASIBLE (or a pool is
 *     held), move the pending applicants to `unmatched` with feedback -- the
 *     waitlist that later retries (C16). Service-role: touches every applicant.
 *   - {@link widenGroupForRole}: fire the 009 group->specialist matcher (T3
 *     surface b) to rank specialists who could fill a thin/contested seat on an
 *     existing proposed group. This is the exact 009 API the widen path reuses.
 *
 * Server-only. Import via `@/lib/teams`.
 */
import { matchSpecialistsForGroup, type SpecialistMatch } from "@/lib/matching";
import type { MembershipRole } from "@/lib/types";
import { adminClient } from "./admin";
import { toProfileRole } from "./roles";

/** Mark a problem's still-pending applicants unmatched (+ feedback). Count moved. */
export async function collectUnmatched(input: {
  problemId: string;
  missingRoles?: string[];
  feedback?: string;
}): Promise<number> {
  const db = adminClient();
  const missing = input.missingRoles ?? [];
  const note =
    input.feedback ??
    (missing.length
      ? `Pool thin on: ${missing.join(", ")}. Held for widening (C16).`
      : "Pool not yet team-complete; held for retry (C16).");

  const { data, error } = await db
    .from("applications")
    .update({ status: "unmatched", feedback: note })
    .eq("problem_id", input.problemId)
    .eq("status", "pending")
    .select("id");
  if (error) return 0;
  return (data ?? []).length;
}

/**
 * Rank specialists to fill a missing/contested `role` on a proposed group via the
 * 009 group->specialist surface. Returns the ranked candidates the caller would
 * invite; empty when 009 is unconfigured (the SQL ordering degrades gracefully).
 */
export async function widenGroupForRole(
  groupId: string,
  role: MembershipRole,
): Promise<SpecialistMatch[]> {
  return matchSpecialistsForGroup(groupId, { role: toProfileRole(role) });
}
