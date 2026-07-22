/**
 * Server-side room load (RLS-scoped). Runs with the per-request anon-key
 * client from `lib/supabase/server`, so every read is filtered by the task-001
 * policies: `groups`/`memberships`/`messages` are visible only to members
 * (`is_member_of`) or the operator. A non-member gets no group row -> `null`.
 *
 * Note (RLS honesty): the `users` policy is self/operator-only, so we can read
 * *our own* name but not co-members'. Member display names arrive live over
 * Presence (each client self-reports its name); until then the chat UI falls
 * back to "Member" (see `authorStyle.displayName`).
 */

import { createClient } from "@/lib/supabase/server";
import type { MembershipRole } from "@/lib/types";
import { MESSAGE_COLUMNS, mapMessageRow, type MessageRow } from "./map";
import type { RoomData, RoomMember } from "./types";

interface MembershipRow {
  user_id: string;
  role: MembershipRole;
  accepted: boolean;
}

/** How many trailing messages to hydrate before Realtime takes over. */
const INITIAL_MESSAGE_LIMIT = 200;

/**
 * Load a room's summary, member roster, and initial thread for the current
 * user. Returns `null` when the room doesn't exist or the caller isn't a member
 * (RLS makes those indistinguishable, which is the intended fail-closed shape).
 */
export async function loadRoom(roomId: string): Promise<RoomData | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: room } = await supabase
    .from("groups")
    .select("id, name, status")
    .eq("id", roomId)
    .maybeSingle();
  if (!room) return null;

  const [membersRes, messagesRes, selfRes] = await Promise.all([
    supabase
      .from("memberships")
      .select("user_id, role, accepted")
      .eq("group_id", roomId)
      .order("created_at", { ascending: true }),
    supabase
      .from("messages")
      .select(MESSAGE_COLUMNS)
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .limit(INITIAL_MESSAGE_LIMIT),
    supabase.from("users").select("name, email").eq("id", user.id).maybeSingle(),
  ]);

  const currentUserName =
    selfRes.data?.name ?? selfRes.data?.email ?? user.email ?? "You";

  const members: RoomMember[] = ((membersRes.data as MembershipRow[] | null) ?? []).map(
    (m) => ({
      userId: m.user_id,
      role: m.role,
      accepted: m.accepted,
      // Only our own name is readable under RLS; others fill in via Presence.
      name: m.user_id === user.id ? currentUserName : null,
    }),
  );

  const messages = ((messagesRes.data as MessageRow[] | null) ?? []).map(mapMessageRow);

  return {
    room: { id: room.id, title: room.name, status: room.status },
    currentUserId: user.id,
    currentUserName,
    members,
    messages,
  };
}
