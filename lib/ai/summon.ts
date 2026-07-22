/**
 * @-summon gate (T5 / F6). The shared AI participant runs ONLY when explicitly
 * summoned -- an @mention of the AI or an "Ask AI" action. Every other human
 * message is just persisted + broadcast (no model call), which is the primary
 * cost lever in a busy room. Pure + import-safe on both the client (composer
 * check before hitting the route) and the server (route double-gate).
 *
 * The gate here is the cheap, deterministic default. To let the AI *volunteer*,
 * a later task can add an ambient Haiku "should the AI chime in?" classifier
 * (models.GATE_MODEL) in front of this -- kept out of here so this module stays
 * client-safe (no Anthropic provider import).
 */

/** Names the AI answers to. The product participant is "Ensemble"; `@ai` is the alias. */
const SUMMON_NAMES = ["ai", "ensemble"];

/** `@ai` / `@ensemble` as a standalone mention token (case-insensitive). */
const MENTION_RE = new RegExp(`(^|\\s)@(?:${SUMMON_NAMES.join("|")})\\b`, "i");

/** "ask ai" / "ask ensemble" phrasing -- the "Ask AI" button submits this too. */
const ASK_RE = new RegExp(`\\bask\\s+(?:${SUMMON_NAMES.join("|")})\\b`, "i");

/** True when a human turn summons the AI participant. */
export function isSummon(content: string): boolean {
  if (!content) return false;
  return MENTION_RE.test(content) || ASK_RE.test(content);
}

/**
 * Drop the leading @mention so the model sees the bare request. Best-effort:
 * returns the trimmed original if stripping would empty the message.
 */
export function stripSummon(content: string): string {
  const stripped = content.replace(MENTION_RE, "$1").trim();
  return stripped.length > 0 ? stripped : content.trim();
}
