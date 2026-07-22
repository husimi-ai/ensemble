/**
 * Shared execution context for the AI participant's tools (T5/T6). The tool
 * *shapes* (description + Zod `inputSchema`) are what the model sees and must
 * stay byte-stable for the cached prompt prefix (F6); the `execute` bodies are
 * built per-summon and bound to this context via a factory, so a tool can act in
 * the right room, on behalf of the right member, without leaking runtime ids
 * into the cached tool JSON.
 */

/** Who + where a tool call runs: the room (== `groups.id`) and the caller. */
export interface ToolContext {
  /** The room the summon happened in; `roomId` == `groups.id`. */
  roomId: string;
  /** The authenticated member who summoned the AI (== `auth.uid()` under RLS). */
  userId: string;
}
