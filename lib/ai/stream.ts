/**
 * Shared AI stream-relay contract (F3). The chat route relays the AI participant's
 * token stream onto the room's realtime channel as `ai_stream` broadcasts; every
 * subscribed client renders the in-progress turn from its subscription instead of
 * the default single-requester SSE. Kept free of server-only imports so the room
 * UI can import the event name + frame type without pulling the service-role
 * client (relay.ts) into the browser bundle.
 */
import type { Message } from "@/lib/types";

/** Broadcast event name for a relayed AI turn (distinct from the human `message` event). */
export const AI_STREAM_EVENT = "ai_stream";

/** Lifecycle of one relayed AI turn. */
export type AiStreamPhase = "start" | "delta" | "end";

/**
 * One relayed frame of an AI turn. `message.id` is stable for the whole turn, so
 * clients key their in-progress buffer off it; `message.content` grows on each
 * `delta`. `start`/`delta` render a live bubble; `end` clears it (the persisted
 * turn then arrives on the normal `message` event with the same id, so there is
 * one render path and no duplicate). No timestamps/ids churn beyond the fixed id.
 */
export interface AiStreamFrame {
  phase: AiStreamPhase;
  message: Message;
}
