/**
 * Relay the AI participant's streamed reply onto the room's realtime channel
 * (F3), plus the server-side room writes the AI turn needs. The AI SDK's default
 * stream goes only to the requester -- wrong for a shared room -- so instead we
 * broadcast `ai_stream` frames as the reply grows, and the final persisted turn
 * on the normal `message` event; every subscribed client renders the same turn.
 *
 * Uses the service-role client (RLS bypass): AI turns carry a null sender_id,
 * which the members-only `messages` insert policy (migration 0006:
 * `sender_id = auth.uid()`) forbids for the request's anon-key client. The relay
 * channel is never subscribed -- `channel.send` for a broadcast falls back to the
 * REST broadcast endpoint, which is exactly what a server relay wants.
 * Server-only: reads SUPABASE_SERVICE_ROLE_KEY. Never import from client code.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { MESSAGE_EVENT, roomTopic } from "@/lib/realtime";
import { MESSAGE_COLUMNS, mapMessageRow, type MessageRow } from "@/lib/rooms";
import type { Message } from "@/lib/types";
import { AI_STREAM_EVENT, type AiStreamPhase } from "./stream";

let admin: SupabaseClient | null = null;

/** Lazily-built service-role client (bypasses RLS; server-only key). */
function adminClient(): SupabaseClient {
  if (admin) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("relay: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  }
  admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

/** An in-progress AI turn bound to one room's channel. */
export interface RoomRelay {
  /** Broadcast a lifecycle frame carrying the current (possibly partial) turn. */
  frame(phase: AiStreamPhase, message: Message): Promise<void>;
  /** Broadcast the final, persisted turn on the normal `message` event. */
  final(message: Message): Promise<void>;
  /** Tear down the ephemeral relay channel. */
  close(): Promise<void>;
}

/**
 * Open a relay for a room. The channel is created but never subscribed, so
 * `send` uses the REST broadcast fallback (private-topic delivery, service-role
 * key authorizes it). Reuses one service-role client across requests.
 */
export function openRoomRelay(roomId: string): RoomRelay {
  const channel = adminClient().channel(roomTopic(roomId), {
    config: { private: true, broadcast: { self: false } },
  });
  return {
    async frame(phase, message) {
      await channel.send({
        type: "broadcast",
        event: AI_STREAM_EVENT,
        payload: { phase, message },
      });
    },
    async final(message) {
      await channel.send({ type: "broadcast", event: MESSAGE_EVENT, payload: message });
    },
    async close() {
      await adminClient().removeChannel(channel);
    },
  };
}

/**
 * Persist a finished AI turn with a caller-chosen id, so the streamed frames and
 * the stored row share one id and clients dedupe cleanly. Service-role: the
 * members-only insert policy forbids the null sender_id AI turns carry.
 */
export async function persistAiMessage(
  roomId: string,
  id: string,
  content: string,
): Promise<Message | null> {
  const { data, error } = await adminClient()
    .from("messages")
    .insert({
      id,
      room_id: roomId,
      sender_id: null,
      sender_kind: "ai",
      kind: "chat",
      content,
    })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error || !data) return null;
  return mapMessageRow(data as MessageRow);
}
