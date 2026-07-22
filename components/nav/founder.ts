/**
 * Founder gate -- placeholder role check.
 *
 * Task 004 needs a founder-only surface (the Operator console, C17) before a
 * real `users.role` / membership-founder concept is wired. Until then the
 * founder is identified by email (spec: moussa@husimi.ai), overridable via the
 * `NEXT_PUBLIC_FOUNDER_EMAIL` env var. Swap this for a DB role check later
 * without touching call sites.
 */

/** The founder account's email (lower-cased). */
export const FOUNDER_EMAIL = (
  process.env.NEXT_PUBLIC_FOUNDER_EMAIL ?? "moussa@husimi.ai"
).toLowerCase();

/** True when `email` is the founder account. Null/undefined is never founder. */
export function isFounder(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === FOUNDER_EMAIL;
}
