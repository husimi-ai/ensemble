/**
 * Assembly orchestration (task 011, T4 TS side). Runs occasionally -- when a
 * problem's applicant pool is ready -- triggered by the operator or a schedule
 * through `app/api/teams/assemble/route.ts`. It calls the Python worker (010) and
 * persists its decision:
 *   - OK        -> one proposed Group + pending Memberships per returned team,
 *                  and the placed applicants flip pending -> assembled.
 *   - INFEASIBLE-> the pending applicants go to the unmatched/widen path (C16).
 *
 * All writes use the service-role client: the anon-key RLS policies reserve
 * groups/memberships inserts for the operator, and a schedule has no session.
 * Server-only. Import via `@/lib/teams`.
 */
import { adminClient } from "./admin";
import { PROFILE_ROLES, toMembershipRole } from "./roles";
import { collectUnmatched } from "./unmatched";
import { callAssembleWorker } from "./worker";
import type { AssembleSummary } from "./types";

/** A team needs at least one distinct person per role (mirrors the worker). */
const TEAM_MIN = PROFILE_ROLES.length;

/**
 * Cheap readiness precheck (the F7 `COUNT(*) GROUP BY role` idea) so we don't
 * call the worker on a pool that plainly can't form a team: enough pending
 * applicants, and every role represented among them.
 */
export async function poolReady(problemId: string): Promise<boolean> {
  const db = adminClient();
  const { data, error } = await db
    .from("applications")
    .select("role")
    .eq("problem_id", problemId)
    .eq("status", "pending");
  if (error) return false;
  const rows = (data ?? []) as { role: string | null }[];
  if (rows.length < TEAM_MIN) return false;
  const present = new Set(rows.map((r) => r.role).filter(Boolean));
  return PROFILE_ROLES.every((r) => present.has(r));
}

/**
 * Assemble one problem's pool end to end. Idempotent-ish: only *pending*
 * applicants are considered, so a re-run after a partial success won't re-place
 * already-assembled people.
 */
export async function assembleProblem(problemId: string): Promise<AssembleSummary> {
  const empty: AssembleSummary = {
    status: "NOT_READY",
    groupsCreated: 0,
    membersPlaced: 0,
    missingRoles: [],
    unmatched: 0,
  };
  if (!(await poolReady(problemId))) return empty;

  const result = await callAssembleWorker({ problemId });

  if (result.status === "INFEASIBLE") {
    const unmatched = await collectUnmatched({
      problemId,
      missingRoles: result.missingRoles,
    });
    return {
      status: "INFEASIBLE",
      groupsCreated: 0,
      membersPlaced: 0,
      missingRoles: result.missingRoles,
      unmatched,
    };
  }

  return persistTeams(problemId, result.teams);
}

/** Persist each returned team as a proposed group + pending memberships. */
async function persistTeams(
  problemId: string,
  teams: { members: { personId: string; role: string }[] }[],
): Promise<AssembleSummary> {
  const db = adminClient();
  let groupsCreated = 0;
  let membersPlaced = 0;
  const placed: string[] = [];

  for (const team of teams) {
    const { data: group, error: gErr } = await db
      .from("groups")
      .insert({ problem_id: problemId, status: "proposed" })
      .select("id")
      .single();
    if (gErr || !group) continue;
    const groupId = group.id as string;

    const seats = team.members.map((m) => ({
      group_id: groupId,
      user_id: m.personId,
      role: toMembershipRole(m.role),
      accepted: false,
    }));
    const { error: mErr } = await db.from("memberships").insert(seats);
    if (mErr) {
      // Don't leave an orphan proposed group with no seats.
      await db.from("groups").delete().eq("id", groupId);
      continue;
    }

    groupsCreated += 1;
    membersPlaced += seats.length;
    for (const m of team.members) placed.push(m.personId);
  }

  if (placed.length) {
    await db
      .from("applications")
      .update({ status: "assembled" })
      .eq("problem_id", problemId)
      .eq("status", "pending")
      .in("user_id", placed);
  }

  return { status: "OK", groupsCreated, membersPlaced, missingRoles: [], unmatched: 0 };
}
