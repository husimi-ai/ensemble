/**
 * Assemble a room thread into speaker-labelled `messages` with an aggressively
 * cached prefix (T5 / F6). The Messages API has only user/assistant roles, so:
 *   - every human turn -> `role:"user"` with an in-band `[Name, role]:` label,
 *   - the AI's own turns -> `role:"assistant"`,
 *   - system events    -> a labelled `[system]:` user turn (context only).
 * The whole thread is loaded on summon and re-sent every time, so prompt caching
 * is the main cost lever: freeze the system prompt + tool defs + older history as
 * the cached prefix and leave only the newest turn uncached. We place ONE cache
 * breakpoint on the last message BEFORE the newest turn -- Anthropic caches the
 * entire prefix up to a breakpoint (tools -> system -> messages), so that single
 * marker caches system + tools + all prior history. No timestamps/ids go into the
 * prefix, keeping it byte-stable across summons (F6).
 */
import type { ModelMessage } from "ai";
import type { Message } from "@/lib/types";

/** In-band identity stamped on a human author's `user` turns. */
export interface AuthorLabel {
  name: string;
  role: string;
}

export interface BuildContextOptions {
  /** senderId -> label. Missing authors fall back to {@link BuildContextOptions.fallback}. */
  authors?: Record<string, AuthorLabel>;
  /** Label when RLS/presence hasn't surfaced a co-member's identity yet. */
  fallback?: AuthorLabel;
}

export interface RoomContext {
  system: string;
  messages: ModelMessage[];
}

/**
 * Frozen participant system prompt. Deterministic and free of timestamps/ids so
 * the cached prefix stays byte-identical across summons (F6). Edit deliberately:
 * any change invalidates every thread's cache the next time it is summoned.
 */
export const SYSTEM_PROMPT = [
  "You are Ensemble, a shared AI participant inside a multi-person research room.",
  "Several humans talk here together; each of their turns is prefixed with an",
  "in-band [Name, role]: label so you can tell speakers apart. Your own past",
  "turns are the assistant turns. You are summoned explicitly (an @mention or an",
  '"Ask AI" action) -- answer the room, not one person, and stay grounded in the',
  "conversation so far. Be concise and concrete. When a request needs external",
  "evidence, heavy compute, a dataset, or a written plan, use the matching tool",
  "rather than guessing; a human approves anything with real-world effect.",
].join(" ");

/** A single Anthropic ephemeral cache breakpoint, as message providerOptions. */
function cacheBreakpoint(): ModelMessage["providerOptions"] {
  return { anthropic: { cacheControl: { type: "ephemeral" } } };
}

/** Resolve a human author's in-band label. */
function labelFor(senderId: string, options: BuildContextOptions): string {
  const author =
    options.authors?.[senderId] ?? options.fallback ?? { name: "Member", role: "member" };
  return `[${author.name}, ${author.role}]`;
}

/** Map one stored room message to a Messages-API turn (in-band labels for humans). */
function toModelMessage(message: Message, options: BuildContextOptions): ModelMessage {
  if (message.senderKind === "ai") {
    return { role: "assistant", content: message.content };
  }
  const label =
    message.senderKind === "system" ? "[system]" : labelFor(message.senderId, options);
  return { role: "user", content: `${label}: ${message.content}` };
}

/**
 * Build the speaker-labelled context for a summon. Empty-content messages with no
 * attachments are dropped (they carry no signal for the model). The cache
 * breakpoint lands on the last message of the stable prefix -- every turn except
 * the newest one -- so the newest (summoning) turn stays uncached.
 */
export function buildContext(
  messages: Message[],
  options: BuildContextOptions = {},
): RoomContext {
  const model: ModelMessage[] = messages
    .filter((m) => m.content.trim().length > 0 || m.attachments.length > 0)
    .map((m) => toModelMessage(m, options));

  // Cache system + tools + all history except the newest turn. Needs >= 2 turns
  // for there to be a stable prefix to cache at all.
  if (model.length >= 2) {
    const stableEnd = model.length - 2;
    model[stableEnd] = { ...model[stableEnd], providerOptions: cacheBreakpoint() };
  }

  return { system: SYSTEM_PROMPT, messages: model };
}
