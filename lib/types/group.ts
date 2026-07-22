/**
 * Formed teams and their memberships. Mirrors `groups`, `memberships`
 * (task 001, migration `0003_groups_membership_messages.sql`). A Group is the
 * unit behind a room: a `Message.roomId` == `groups.id`.
 */

/** Team lifecycle (C10 accept -> active). Column `groups.status`. */
export type GroupStatus =
  | "proposed"
  | "confirming"
  | "active"
  | "submitted"
  | "handed_over";

/**
 * A formed team on a problem (a.k.a. Project / Ensemble); many groups may
 * tackle one problem. Table `groups`. DB mapping: `problemId`<->`problem_id`.
 */
export interface Group {
  id: string;
  problemId: string;
  title: string | null;
  status: GroupStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * A member's role in a group. `founder` is on every group (C17); accepted
 * data-providers/specialists join as `provider` (C15). Column `memberships.role`.
 */
export type MembershipRole =
  | "problem"
  | "builder"
  | "researcher"
  | "provider"
  | "founder";

/**
 * A User <-> Group link with an accept gate (C10 unanimous accept). Table
 * `memberships`. DB mapping: `groupId`<->`group_id`, `userId`<->`user_id`.
 */
export interface Membership {
  id: string;
  groupId: string;
  userId: string;
  role: MembershipRole;
  accepted: boolean;
  createdAt: string;
}
