"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useState } from "react";
import { AI_STREAM_EVENT, type AiStreamFrame } from "@/lib/ai/stream";
import { isSummon } from "@/lib/ai/summon";
import type { Message } from "@/lib/types";

/**
 * Client glue for the shared AI participant (F3). Two jobs:
 *   1. render the AI's live turn from the room channel -- the chat route relays
 *      `ai_stream` frames onto the same Broadcast channel, so the reply does NOT
 *      come back over this client's fetch; every participant renders identically.
 *   2. summon the route when a human turn @-mentions the AI (fire-and-forget).
 *
 * Returns the in-progress AI messages to merge into the thread. The finished turn
 * arrives on the normal `message` event with the SAME id, so once it lands in the
 * thread the streaming copy is dropped (the caller filters by id) and the `end`
 * frame clears the buffer.
 */
export function useAiParticipant(roomId: string) {
  const [streaming, setStreaming] = useState<Record<string, Message>>({});

  /** Attach an extra broadcast listener onto the already-open room channel. */
  const bind = useCallback((channel: RealtimeChannel) => {
    channel.on<AiStreamFrame>("broadcast", { event: AI_STREAM_EVENT }, ({ payload }) => {
      setStreaming((prev) => {
        if (payload.phase === "end") {
          if (!(payload.message.id in prev)) return prev;
          const next = { ...prev };
          delete next[payload.message.id];
          return next;
        }
        return { ...prev, [payload.message.id]: payload.message };
      });
    });
  }, []);

  /** Fire the chat route when a human turn summons the AI. */
  const summon = useCallback(
    (content: string) => {
      if (!isSummon(content)) return;
      void fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId }),
      }).catch(() => {
        // Relay is best-effort; a failed summon just means no AI turn this time.
      });
    },
    [roomId],
  );

  return { bind, summon, streamingMessages: Object.values(streaming) };
}
