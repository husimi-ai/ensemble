/**
 * Read-side loaders for the teams surfaces (task 011), RLS-scoped to the request
 * user. `loadAppliedProblemIds` powers the feed's applied state; `loadInvitations`
 * powers the team-accept screen (proposed/confirming groups the user is a seat on).
 *
 * RLS honesty (same as rooms): the `users` policy is self/operator-only, so we can
 * read our own name but not co-members' -- their `name` stays null and the accept
 * card shows role + "Member". Server-only. Import via `@/lib/teams`.
 */
import { createClient } from "@/lib/supabase/server";
import type { GroupStatus, MembershipRole } from "@/lib/types";
import type { TeamInvitation, TeamMemberView } from "./types";

/** Problem ids the signed-in user already has any application on (feed state). */
export async function loadAppliedProblemIds(): Promise<Set<string>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();
  const { data } = await supabase
    .from("applications")
    .select("problem_id")
    .eq("user_id", user.id);
  return new Set(((data ?? []) as { problem_id: string }[]).map((r) => r.problem_id));
}

interface GroupRel {
  id: string;
  name: string | null;
  status: GroupStatus;
  problem_id: string;
}
interface MyMembershipRow {
  group_id: string;
  role: MembershipRole;
  accepted: boolean;
  groups: unknown;
}
interface SeatRow {
  group_id: string;
  user_id: string;
  role: MembershipRole;
  accepted: boolean;
}
interface ProblemRow {
  id: string;
  title: string;
  description: string | null;
  subfield: string | null;
}

function firstOf<T>(rel: unknown): T | null {
  if (Array.isArray(rel)) return (rel[0] as T | undefined) ?? null;
  return (rel as T | null) ?? null;
}

/** Proposed/confirming teams the signed-in user is a seat on (accept screen). */
export async function loadInvitations(): Promise<TeamInvitation[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: mine } = await supabase
    .from("memberships")
    .select("group_id, role, accepted, groups(id, name, status, problem_id)")
    .eq("user_id", user.id);

  const myRows = ((mine as MyMembershipRow[] | null) ?? [])
    .map((m) => ({ seat: m, group: firstOf<GroupRel>(m.groups) }))
    .filter(
      (r): r is { seat: MyMembershipRow; group: GroupRel } =>
        !!r.group && (r.group.status === "proposed" || r.group.status === "confirming"),
    );
  if (!myRows.length) return [];

  const groupIds = myRows.map((r) => r.group.id);
  const problemIds = [...new Set(myRows.map((r) => r.group.problem_id))];

  const [seatsRes, problemsRes, selfRes] = await Promise.all([
    supabase.from("memberships").select("group_id, user_id, role, accepted").in("group_id", groupIds),
    supabase.from("problems").select("id, title, description, subfield").in("id", problemIds),
    supabase.from("users").select("name, email").eq("id", user.id).maybeSingle(),
  ]);

  const seatsByGroup = new Map<string, SeatRow[]>();
  for (const s of (seatsRes.data as SeatRow[] | null) ?? []) {
    const list = seatsByGroup.get(s.group_id) ?? [];
    list.push(s);
    seatsByGroup.set(s.group_id, list);
  }
  const problemById = new Map<string, ProblemRow>();
  for (const p of (problemsRes.data as ProblemRow[] | null) ?? []) problemById.set(p.id, p);
  const selfName = selfRes.data?.name ?? selfRes.data?.email ?? user.email ?? "You";

  return myRows.map(({ seat, group }) =>
    buildInvitation(group, seat, seatsByGroup.get(group.id) ?? [], problemById, user.id, selfName),
  );
}

/** Assemble one {@link TeamInvitation} from the loaded roster + problem. */
function buildInvitation(
  group: GroupRel,
  seat: MyMembershipRow,
  roster: SeatRow[],
  problemById: Map<string, ProblemRow>,
  userId: string,
  selfName: string,
): TeamInvitation {
  const members: TeamMemberView[] = roster.map((m) => ({
    userId: m.user_id,
    role: m.role,
    accepted: m.accepted,
    isSelf: m.user_id === userId,
    name: m.user_id === userId ? selfName : null,
  }));
  const problem = problemById.get(group.problem_id);
  return {
    groupId: group.id,
    groupTitle: group.name,
    status: group.status,
    problem: {
      id: group.problem_id,
      title: problem?.title ?? "Untitled problem",
      description: problem?.description ?? "",
      subfield: problem?.subfield ?? null,
    },
    members,
    selfRole: seat.role,
    selfAccepted: seat.accepted,
    acceptedCount: members.filter((m) => m.accepted).length,
    totalCount: members.length,
  };
}
