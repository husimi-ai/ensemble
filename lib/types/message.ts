/**
 * Multi-author room message model -- the authoritative chat type (F1, F3).
 *
 * Mirrors the `messages` table (task 001, migration
 * `0003_groups_membership_messages.sql`). TS is camelCase, the DB is
 * snake_case: `roomId`<->`room_id`, `senderId`<->`sender_id`,
 * `senderKind`<->`sender_kind`, `createdAt`<->`created_at`; `attachments`
 * is a jsonb array. A room is a Group room, so `roomId` == `groups.id`.
 *
 * This replaces the single-user `Role = 'user' | 'assistant'` /
 * `ChatMessage` shape. Those legacy aliases + bridge helpers live at the
 * bottom of this file and stay exported so the not-yet-refactored chat UI
 * (Thread/Message/MessageActions) keeps compiling until task 005 migrates it.
 */

/** Who authored a message: a person, the AI participant, or the system. */
export type SenderKind = "human" | "ai" | "system";

/** What a message carries -- a normal turn or a structured AI artifact. */
export type MessageKind = "chat" | "research_result" | "work_guide" | "system";

/**
 * One element of the `messages.attachments` jsonb array. Files live in a
 * Storage bucket (`attachments` | `cvs` | `versions`, task 001 migration
 * `0007_realtime_storage.sql`) addressed by `bucket` + `path`.
 */
export interface Attachment {
  id: string;
  bucket: string;
  path: string;
  name: string;
  mimeType: string;
  size: number;
}

/** One message in a Group room. Row of `messages`, delivered over Realtime. */
export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  senderKind: SenderKind;
  kind: MessageKind;
  content: string;
  attachments: Attachment[];
  createdAt: string;
}

/* ------------------------------------------------------------------ *
 * Legacy single-user bridge -- remove once task 005 refactors the UI.
 * ------------------------------------------------------------------ */

/** @deprecated Legacy ChatGPT-style role. Use {@link SenderKind}. */
export type Role = "user" | "assistant";

/** @deprecated Legacy single-user message. Use {@link Message}. */
export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
}

/** Legacy role -> multi-author sender kind. */
export function roleToSenderKind(role: Role): SenderKind {
  return role === "user" ? "human" : "ai";
}

/** Multi-author sender kind -> legacy role (ai/system both render as assistant). */
export function senderKindToRole(kind: SenderKind): Role {
  return kind === "human" ? "user" : "assistant";
}

/** Project a {@link Message} down to the legacy shape for un-refactored UI. */
export function messageToChatMessage(message: Message): ChatMessage {
  return {
    id: message.id,
    role: senderKindToRole(message.senderKind),
    content: message.content,
  };
}

/**
 * Lift a legacy {@link ChatMessage} into a {@link Message}. The caller supplies
 * the room/sender context the single-user shape never had.
 */
export function chatMessageToMessage(
  chat: ChatMessage,
  ctx: { roomId: string; senderId: string; createdAt?: string },
): Message {
  return {
    id: chat.id,
    roomId: ctx.roomId,
    senderId: ctx.senderId,
    senderKind: roleToSenderKind(chat.role),
    kind: "chat",
    content: chat.content,
    attachments: [],
    createdAt: ctx.createdAt ?? new Date().toISOString(),
  };
}
