"use server";

/**
 * Team-accept actions (task 011, C10 unanimous accept + role-contest, C17 founder
 * auto-add). A member accepts or contests their seat on a proposed group:
 *   - {@link acceptMembership}: flip the caller's own seat `accepted = true`
 *     (RLS `memberships_update` self). When every seat is accepted the group is
 *     activated (status -> active) and the founder is added as a member (C17);
 *     otherwise it moves to `confirming`. Activation uses the service-role client
 *     because the founder insert + group activation are operator-reserved writes.
 *   - {@link contestRole}: leave the seat unaccepted (which blocks activation),
 *     record the reason as application feedback + `unmatched`, and fire the 009
 *     widen for that role so a better-fit specialist can be surfaced (C16).
 *
 * Import via `@/lib/teams`.
 */
import { revalidatePath } from "next/cache";
import { isFounder } from "@/components/nav/founder";
import { createClient } from "@/lib/supabase/server";
import type { MembershipRole } from "@/lib/types";
import { adminClient } from "./admin";
import type { ActionResult } from "./types";
import { widenGroupForRole } from "./unmatched";

/** Accept the caller's seat; activate the group when the team is unanimous. */
export async function acceptMembership(groupId: string): Promise<ActionResult> {
  try {
    if (!groupId) return { error: "Missing team." };
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Sign in to respond." };

    const { error } = await supabase
      .from("memberships")
      .update({ accepted: true })
      .eq("group_id", groupId)
      .eq("user_id", user.id);
    if (error) return { error: error.message };

    const phase = await transitionAfterAccept(groupId);
    revalidatePath("/invitations");
    return {
      ok: true,
      note:
        phase === "active"
          ? "Everyone accepted -- your room is open."
          : "Accepted. Waiting on the rest of the team.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not accept." };
  }
}

/** Contest the caller's assigned role: block activation + trigger the widen. */
export async function contestRole(input: {
  groupId: string;
  reason: string;
}): Promise<ActionResult> {
  try {
    if (!input.groupId) return { error: "Missing team." };
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Sign in to respond." };

    const { data: seat } = await supabase
      .from("memberships")
      .select("role, groups(problem_id)")
      .eq("group_id", input.groupId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!seat) return { error: "You're not on this team." };
    const role = seat.role as MembershipRole;
    const problemId = firstOf<{ problem_id: string }>(
      (seat as { groups: unknown }).groups,
    )?.problem_id;

    const reason = input.reason.trim() || "Assigned role contested.";
    // Keep the seat unaccepted (blocks the unanimous gate) and log the contest as
    // application feedback -> unmatched (the C16 loop reads this).
    await supabase
      .from("memberships")
      .update({ accepted: false })
      .eq("group_id", input.groupId)
      .eq("user_id", user.id);
    if (problemId) {
      await supabase
        .from("applications")
        .update({ status: "unmatched", feedback: reason })
        .eq("problem_id", problemId)
        .eq("user_id", user.id);
    }

    // Fire the 009 group->specialist widen for the contested seat (best-effort).
    let widened = 0;
    try {
      widened = (await widenGroupForRole(input.groupId, role)).length;
    } catch {
      // widen is advisory; the contest itself already blocks activation.
    }

    revalidatePath("/invitations");
    return {
      ok: true,
      note: `Role contested -- surfaced ${widened} specialist${
        widened === 1 ? "" : "s"
      } to re-fill the seat.`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not contest." };
  }
}

/** Embedded to-one relation arrives as an object (or defensively an array). */
function firstOf<T>(rel: unknown): T | null {
  if (Array.isArray(rel)) return (rel[0] as T | undefined) ?? null;
  return (rel as T | null) ?? null;
}

interface SeatRow {
  user_id: string;
  accepted: boolean;
}

/**
 * After a seat accepts, advance the group: `active` (all accepted -> add founder,
 * C17) or `confirming` (some accepted). Service-role: founder insert + activation
 * are operator-reserved. No-ops once the group has left proposed/confirming.
 */
async function transitionAfterAccept(
  groupId: string,
): Promise<"active" | "confirming" | null> {
  const db = adminClient();
  const { data: group } = await db
    .from("groups")
    .select("id, status")
    .eq("id", groupId)
    .maybeSingle();
  if (!group) return null;
  const status = group.status as string;
  if (status !== "proposed" && status !== "confirming") return null;

  const { data: members } = await db
    .from("memberships")
    .select("user_id, accepted")
    .eq("group_id", groupId);
  const seats = (members ?? []) as SeatRow[];
  const unanimous = seats.length > 0 && seats.every((m) => m.accepted);

  if (!unanimous) {
    await db.from("groups").update({ status: "confirming" }).eq("id", groupId);
    return "confirming";
  }

  await addFounder(groupId, seats);
  await db.from("groups").update({ status: "active" }).eq("id", groupId);
  return "active";
}

/** Add the founder as an accepted member of every activated group (C17). */
async function addFounder(groupId: string, seats: SeatRow[]): Promise<void> {
  const db = adminClient();
  const { data: users } = await db.from("users").select("id, email");
  const rows = (users ?? []) as { id: string; email: string | null }[];
  const founder = rows.find((u) => isFounder(u.email));
  if (!founder) return; // no founder account provisioned yet -- activate without.
  if (seats.some((m) => m.user_id === founder.id)) return;
  await db
    .from("memberships")
    .insert({ group_id: groupId, user_id: founder.id, role: "founder", accepted: true });
}
