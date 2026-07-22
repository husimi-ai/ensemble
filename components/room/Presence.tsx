"use client";

import { initialOf } from "@/components/chat/authorStyle";
import type { PresenceRoster } from "@/lib/realtime";

/** How many avatars to stack before collapsing the rest into a "+N". */
const MAX_AVATARS = 4;

/**
 * Live "who's online" strip: stacked initial-avatars for the tracked peers plus
 * a count. Fed by the room channel's Presence state (each peer self-reports its
 * name, since RLS won't hand co-members' names to the client).
 */
export function Presence({ roster }: { roster: PresenceRoster }) {
  const online = roster.length;
  const shown = roster.slice(0, MAX_AVATARS);
  const extra = online - shown.length;

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-1.5">
        {shown.map((p) => (
          <div
            key={p.userId}
            title={p.name}
            className="grid h-6 w-6 place-items-center rounded-full border border-canvas bg-muted text-[11px] font-medium text-fg-secondary"
          >
            {initialOf(p.name)}
          </div>
        ))}
        {extra > 0 && (
          <div className="grid h-6 w-6 place-items-center rounded-full border border-canvas bg-muted text-[10px] font-medium text-fg-secondary">
            +{extra}
          </div>
        )}
      </div>
      <span className="flex items-center gap-1.5 text-xs text-fg-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
        {online} online
      </span>
    </div>
  );
}
