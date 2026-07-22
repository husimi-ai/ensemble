/**
 * Room view-model shapes shared between the server loader (`data.ts`) and the
 * client room UI (`components/room/*`). Kept free of `next/headers` /
 * server-only imports so client components can import these types without
 * dragging the server Supabase client into their bundle.
 */

import type { GroupStatus, MembershipRole, Message } from "@/lib/types";

/**
 * One member of a room, from `memberships` (+ role). `name` resolves only for
 * the current user under RLS -- co-members' `users` rows aren't readable, so
 * their display name arrives live via Presence (`RoomPresenceMeta.name`).
 */
export interface RoomMember {
  userId: string;
  role: MembershipRole;
  accepted: boolean;
  name: string | null;
}

/** The room (a Group) header info. `roomId` == `groups.id`. */
export interface RoomSummary {
  id: string;
  title: string | null;
  status: GroupStatus;
}

/**
 * Everything the server loads for a room render before Realtime hydrates:
 * the room, the current viewer, the member roster, and the initial thread.
 * `null` from the loader means "no such room or you aren't a member" (RLS).
 */
export interface RoomData {
  room: RoomSummary;
  currentUserId: string;
  currentUserName: string;
  members: RoomMember[];
  messages: Message[];
}
