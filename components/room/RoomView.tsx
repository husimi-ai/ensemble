"use client";

import { ArrowUp, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AuthorInfo } from "@/components/chat/authorStyle";
import { Thread } from "@/components/chat/Thread";
import { Composer } from "@/components/composer/Composer";
import { AttachmentUpload } from "@/components/room/AttachmentUpload";
import { RoomHeader } from "@/components/room/RoomHeader";
import { useAiParticipant } from "@/components/room/useAiParticipant";
import {
  type PresenceRoster,
  type RoomPresenceMeta,
  type RoomSubscription,
  sendRoomMessage,
  subscribeToRoom,
} from "@/lib/realtime";
import type { RoomData } from "@/lib/rooms/types";
import { createClient } from "@/lib/supabase/client";
import type { Attachment, Message } from "@/lib/types";

/** Insert `msg` keeping the thread id-deduped and in `createdAt` order. */
function mergeMessage(prev: Message[], msg: Message): Message[] {
  if (prev.some((m) => m.id === msg.id)) return prev;
  const next = [...prev, msg];
  next.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  return next;
}

/**
 * Live room surface (F3): server-hydrated thread + membership, then a Supabase
 * Realtime subscription drives messages and Presence. Sending persists to
 * `messages` AND broadcasts; every client (this one included) renders from the
 * subscription, so there's one render path.
 */
export function RoomView({ data }: { data: RoomData }) {
  const [supabase] = useState(() => createClient());
  const [messages, setMessages] = useState<Message[]>(data.messages);
  const [roster, setRoster] = useState<PresenceRoster>([]);
  const [pending, setPending] = useState<Attachment[]>([]);
  const subRef = useRef<RoomSubscription | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Shared AI participant (F3): live turn relayed over the room channel + @-summon.
  const { bind: bindAi, summon: summonAi, streamingMessages } = useAiParticipant(data.room.id);

  const me: RoomPresenceMeta = useMemo(
    () => ({
      userId: data.currentUserId,
      name: data.currentUserName,
      role: data.members.find((m) => m.userId === data.currentUserId)?.role ?? "builder",
      onlineAt: new Date().toISOString(),
    }),
    [data],
  );

  useEffect(() => {
    const sub = subscribeToRoom(supabase, {
      roomId: data.room.id,
      me,
      onMessage: (m) => setMessages((prev) => mergeMessage(prev, m)),
      onPresence: setRoster,
    });
    // The AI's streamed turn is broadcast on the same channel (a separate event),
    // so bind its listener onto this subscription (broadcast binds match locally).
    bindAi(sub.channel);
    subRef.current = sub;
    return () => {
      sub.close();
      subRef.current = null;
    };
  }, [supabase, data.room.id, me, bindAi]);

  const authors = useMemo<Record<string, AuthorInfo>>(() => {
    const map: Record<string, AuthorInfo> = {};
    for (const p of roster) map[p.userId] = { name: p.name };
    map[data.currentUserId] = { name: data.currentUserName };
    return map;
  }, [roster, data.currentUserId, data.currentUserName]);

  // Merge the AI's in-progress (relayed) turn into the thread. Once its final,
  // persisted copy lands via the normal message event (same id), the streaming
  // copy is filtered out, so there is one render path and no duplicate.
  const visibleMessages = useMemo<Message[]>(() => {
    if (streamingMessages.length === 0) return messages;
    const extra = streamingMessages.filter((s) => !messages.some((m) => m.id === s.id));
    if (extra.length === 0) return messages;
    return [...messages, ...extra].sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    );
  }, [messages, streamingMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [visibleMessages]);

  async function send(content: string, attachments: Attachment[]) {
    const sub = subRef.current;
    if (!sub || (!content && attachments.length === 0)) return;
    setPending([]);
    const sent = await sendRoomMessage(supabase, sub.channel, {
      roomId: data.room.id,
      senderId: data.currentUserId,
      content,
      attachments,
    });
    // Only summon the AI once the human turn is persisted + broadcast (F3 order).
    if (sent) summonAi(content);
  }

  return (
    <div className="flex h-full flex-col">
      <RoomHeader room={data.room} members={data.members} roster={roster} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Thread messages={visibleMessages} currentUserId={data.currentUserId} authors={authors} />
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-line-light px-4 py-3">
        {pending.length > 0 && (
          <div className="mx-auto mb-2 flex w-full max-w-thread flex-wrap items-center gap-1.5">
            {pending.map((a) => (
              <span
                key={a.id}
                className="flex items-center gap-1.5 rounded-lg border border-line-light bg-subtle py-1 pl-2.5 pr-1 text-xs text-fg-secondary"
              >
                {a.name}
                <button
                  type="button"
                  aria-label={`Remove ${a.name}`}
                  onClick={() => setPending((p) => p.filter((x) => x.id !== a.id))}
                  className="grid h-5 w-5 place-items-center rounded text-fg-muted hover:bg-hover"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <button
              type="button"
              aria-label="Send files"
              onClick={() => void send("", pending)}
              className="grid h-6 w-6 place-items-center rounded-full bg-primary text-fg-inverted hover:bg-primary-hover"
            >
              <ArrowUp size={14} />
            </button>
          </div>
        )}

        <div className="mx-auto flex w-full max-w-thread items-end gap-2">
          <AttachmentUpload
            roomId={data.room.id}
            onAttach={(a) => setPending((p) => [...p, a])}
          />
          <div className="min-w-0 flex-1">
            <Composer onSend={(text) => void send(text, pending)} />
          </div>
        </div>
      </div>
    </div>
  );
}
