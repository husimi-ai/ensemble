"use client";

import { initialOf } from "@/components/chat/authorStyle";
import { Presence } from "@/components/room/Presence";
import { SubmitVersion } from "@/components/room/SubmitVersion";
import { VersionHistory } from "@/components/room/VersionHistory";
import type { PresenceRoster } from "@/lib/realtime";
import type { RoomMember, RoomSummary } from "@/lib/rooms/types";
import type { MembershipRole } from "@/lib/types";

/** Human label for a membership role (domain enum -> display). */
const ROLE_LABEL: Record<MembershipRole, string> = {
  problem: "Problem-holder",
  builder: "Builder",
  researcher: "Researcher",
  provider: "Provider",
  founder: "Founder",
};

/**
 * Room chrome above the thread: title + status on the left, live Presence on
 * the right, and a roster row of members with their roles. Member names resolve
 * from Presence (live) for co-members, falling back to "Member" until they come
 * online (RLS keeps co-members' `users` rows unreadable).
 */
export function RoomHeader({
  room,
  members,
  roster,
}: {
  room: RoomSummary;
  members: RoomMember[];
  roster: PresenceRoster;
}) {
  const liveName = new Map(roster.map((p) => [p.userId, p.name]));

  return (
    <header className="border-b border-line-light bg-canvas px-4 py-3">
      <div className="mx-auto flex w-full max-w-thread items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-fg">
            {room.title ?? "Untitled room"}
          </h1>
          <p className="text-xs capitalize text-fg-muted">{room.status.replace(/_/g, " ")}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <VersionHistory groupId={room.id} />
          <SubmitVersion roomId={room.id} />
          <Presence roster={roster} />
        </div>
      </div>

      <div className="mx-auto mt-2 flex w-full max-w-thread flex-wrap gap-1.5">
        {members.map((m) => {
          const name = m.name ?? liveName.get(m.userId) ?? "Member";
          const isOnline = liveName.has(m.userId);
          return (
            <span
              key={m.userId}
              className="flex items-center gap-1.5 rounded-full border border-line bg-subtle py-1 pl-1 pr-2.5 text-xs text-fg-secondary"
            >
              <span className="relative grid h-5 w-5 place-items-center rounded-full bg-muted text-[10px] font-medium text-fg-secondary">
                {initialOf(name)}
                {isOnline && (
                  <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-canvas bg-accent" />
                )}
              </span>
              <span className="max-w-[120px] truncate text-fg">{name}</span>
              <span className="text-fg-muted">{ROLE_LABEL[m.role]}</span>
            </span>
          );
        })}
      </div>
    </header>
  );
}
