/**
 * Pure `messages` row <-> {@link Message} mapping. Shared by the server loader
 * and the Realtime send path; deliberately side-effect-free (no Supabase client,
 * no `next/headers`) so it is safe to import from client code.
 *
 * The DB is snake_case, the TS model camelCase (see `lib/types/message.ts`).
 */

import type { Attachment, Message, MessageKind, SenderKind } from "@/lib/types";

/** Columns to select for a full {@link Message}, in one place so reads stay in sync. */
export const MESSAGE_COLUMNS =
  "id, room_id, sender_id, sender_kind, kind, content, attachments, created_at";

/** Raw `messages` row as returned by the columns in {@link MESSAGE_COLUMNS}. */
export interface MessageRow {
  id: string;
  room_id: string;
  sender_id: string | null;
  sender_kind: SenderKind;
  kind: MessageKind;
  content: string | null;
  attachments: Attachment[] | null;
  created_at: string;
}

/** Map a `messages` row to the camelCase {@link Message} the chat UI renders. */
export function mapMessageRow(row: MessageRow): Message {
  return {
    id: row.id,
    roomId: row.room_id,
    // ai/system turns have a null sender_id; the chat UI keys "own" off senderId
    // so an empty string (never equal to a real user id) reads as "not me".
    senderId: row.sender_id ?? "",
    senderKind: row.sender_kind,
    kind: row.kind,
    content: row.content ?? "",
    attachments: row.attachments ?? [],
    createdAt: row.created_at,
  };
}
