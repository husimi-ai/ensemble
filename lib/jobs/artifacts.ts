/**
 * Post an AI-authored artifact message into a room and broadcast it (T5). Used
 * by the deep-research worker (`kind: "research_result"`) and the work-guide
 * drafter (`kind: "work_guide"`) -- both produce an `ai` turn with a null
 * `sender_id`, which the members-only `messages` insert policy (0006:
 * `sender_id = auth.uid()`) forbids for an anon-key client. So the write goes
 * through the service-role client (RLS bypass), then the stored row is broadcast
 * on the room's realtime channel via the same relay the chat turn uses (F3), so
 * every participant renders it through the one `message` path (dedupe by id).
 *
 * Server-only: reuses the service-role singleton + the relay. Never import from
 * client code.
 */
import { openRoomRelay, type RoomRelay } from "@/lib/ai/relay";
import { MESSAGE_COLUMNS, mapMessageRow, type MessageRow } from "@/lib/rooms";
import { adminClient } from "@/lib/teams/admin";
import type { Message, MessageKind } from "@/lib/types";

/** One AI artifact to drop into a room. `id` is optional (DB generates one). */
export interface AiArtifact {
  roomId: string;
  kind: MessageKind;
  content: string;
  /** Pin the message id (e.g. to a job id) so streamed progress + the final row align. */
  id?: string;
}

/**
 * Persist an `ai` artifact message (service-role) and broadcast it on the room
 * channel. Returns the stored {@link Message}, or `null` if the insert failed.
 */
export async function postAiArtifact({
  roomId,
  kind,
  content,
  id,
}: AiArtifact): Promise<Message | null> {
  const { data, error } = await adminClient()
    .from("messages")
    .insert({
      ...(id ? { id } : {}),
      room_id: roomId,
      sender_id: null,
      sender_kind: "ai",
      kind,
      content,
    })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error || !data) {
    if (error) console.error("[artifacts] persist failed", error);
    return null;
  }

  const message = mapMessageRow(data as MessageRow);
  let relay: RoomRelay | null = null;
  try {
    relay = openRoomRelay(roomId);
    await relay.final(message);
  } catch (err) {
    console.error("[artifacts] broadcast failed", err);
  } finally {
    if (relay) await relay.close();
  }
  return message;
}
