/**
 * Room Realtime plumbing (F3): one multiplexed private channel per room named
 * `room:<group_id>`. Broadcast carries messages, Presence carries who's online.
 * The channel is `private: true`, so Supabase's Broadcast Authorization (RLS on
 * `realtime.messages`, migration 0007) gates subscribe/send to room members.
 *
 * A human message is BOTH persisted to `messages` (RLS) AND broadcast on the
 * channel; every client -- the sender included (`broadcast.self`) -- renders
 * from its subscription, so there is a single render path (dedupe by id).
 */

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";
import type { Attachment, Message, MembershipRole } from "@/lib/types";
import { MESSAGE_COLUMNS, mapMessageRow, type MessageRow } from "@/lib/rooms/map";

/** Broadcast event name for a room chat message. */
export const MESSAGE_EVENT = "message";

/** Channel topic for a room. Matches the `room:<group_id>` RLS convention (0007). */
export function roomTopic(roomId: string): string {
  return `room:${roomId}`;
}

/** Self-reported presence payload -- lets peers show a name RLS won't hand them. */
export interface RoomPresenceMeta {
  userId: string;
  name: string;
  role: MembershipRole;
  onlineAt: string;
}

/** The distinct online peers currently tracked on the channel. */
export type PresenceRoster = RoomPresenceMeta[];

export interface SubscribeParams {
  roomId: string;
  /** This client's presence payload; also used as the presence key (userId). */
  me: RoomPresenceMeta;
  onMessage: (message: Message) => void;
  onPresence: (roster: PresenceRoster) => void;
  onStatus?: (status: REALTIME_SUBSCRIBE_STATES) => void;
}

/** A live room subscription; call {@link RoomSubscription.close} to tear down. */
export interface RoomSubscription {
  channel: RealtimeChannel;
  close: () => void;
}

/** Flatten the presence state map to one entry per online peer. */
function readRoster(channel: RealtimeChannel): PresenceRoster {
  const state = channel.presenceState<RoomPresenceMeta>();
  const roster: PresenceRoster = [];
  for (const key of Object.keys(state)) {
    const first = state[key]?.[0];
    if (first) {
      roster.push({
        userId: first.userId,
        name: first.name,
        role: first.role,
        onlineAt: first.onlineAt,
      });
    }
  }
  return roster;
}

/**
 * Subscribe to a room's channel: wire Broadcast (messages) + Presence (roster),
 * then track this client. Returns immediately; `subscribe` resolves async and
 * tracks presence once `SUBSCRIBED`. `setAuth()` refreshes the socket's JWT so
 * the private-channel RLS check sees the current user.
 */
export function subscribeToRoom(
  supabase: SupabaseClient,
  { roomId, me, onMessage, onPresence, onStatus }: SubscribeParams,
): RoomSubscription {
  const channel = supabase.channel(roomTopic(roomId), {
    config: {
      private: true,
      broadcast: { self: true },
      presence: { key: me.userId },
    },
  });

  channel
    .on<Message>("broadcast", { event: MESSAGE_EVENT }, ({ payload }) => onMessage(payload))
    .on("presence", { event: "sync" }, () => onPresence(readRoster(channel)));

  void supabase.realtime.setAuth().then(() => {
    channel.subscribe((status) => {
      onStatus?.(status);
      if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
        void channel.track(me);
      }
    });
  });

  return {
    channel,
    close: () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
    },
  };
}

export interface SendMessageParams {
  roomId: string;
  senderId: string;
  content: string;
  attachments?: Attachment[];
}

/**
 * Persist a human message to `messages` (RLS enforces membership + own
 * sender_id) and broadcast the stored row to the room channel. Returns the
 * persisted {@link Message}, or `null` if the insert was rejected.
 */
export async function sendRoomMessage(
  supabase: SupabaseClient,
  channel: RealtimeChannel,
  { roomId, senderId, content, attachments = [] }: SendMessageParams,
): Promise<Message | null> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      room_id: roomId,
      sender_id: senderId,
      sender_kind: "human",
      kind: "chat",
      content,
      attachments,
    })
    .select(MESSAGE_COLUMNS)
    .single();

  if (error || !data) return null;

  const message = mapMessageRow(data as MessageRow);
  await channel.send({ type: "broadcast", event: MESSAGE_EVENT, payload: message });
  return message;
}
