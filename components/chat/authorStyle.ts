/**
 * Presentational helpers for rendering a `Message` by author -- name/avatar
 * lookup, visual grouping of consecutive same-author messages, and the small
 * copy strings used by AI artifact blocks. `Message` itself carries no
 * denormalized author name/avatar (it only has `senderId`), so callers
 * (task 012's room wiring) pass an `authors` lookup down through `Thread`.
 */

import type { Message, MessageKind } from "@/lib/types";

/** Denormalized display info for a human sender, keyed by `senderId`. */
export interface AuthorInfo {
  name: string;
  avatarUrl?: string | null;
}

/** Consecutive messages from the same sender within this window group visually. */
const GROUP_WINDOW_MS = 5 * 60 * 1000;

/** First-letter avatar fallback, uppercased; "?" for empty/whitespace input. */
export function initialOf(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0]!.toUpperCase() : "?";
}

/** Display name for a message's sender: human lookup, the AI's name, or "System". */
export function displayName(
  message: Message,
  authors: Record<string, AuthorInfo> | undefined,
  aiName: string,
): string {
  if (message.senderKind === "ai") return aiName;
  if (message.senderKind === "system") return "System";
  return authors?.[message.senderId]?.name ?? "Member";
}

/**
 * True when `message` should start a new visual group relative to the
 * message before it -- different sender, different sender kind, or a gap
 * over {@link GROUP_WINDOW_MS}. A new group repeats the avatar/name/timestamp;
 * a grouped message renders tighter, with identity omitted.
 */
export function startsNewGroup(message: Message, previous: Message | undefined): boolean {
  if (!previous) return true;
  if (previous.senderId !== message.senderId || previous.senderKind !== message.senderKind) {
    return true;
  }
  const gap = Date.parse(message.createdAt) - Date.parse(previous.createdAt);
  return !Number.isFinite(gap) || gap > GROUP_WINDOW_MS;
}

/** Short localized clock time (e.g. "10:32 AM") shown once per visual group. */
export function formatTimeLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

/** Header label for a structured AI artifact block; "" for a plain chat turn. */
export function kindLabel(kind: MessageKind): string {
  switch (kind) {
    case "research_result":
      return "Research result";
    case "work_guide":
      return "Work guide";
    default:
      return "";
  }
}
