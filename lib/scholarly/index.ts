/**
 * Open scholarly sources -- shared REST core + module barrel (T1, F5).
 *
 * Server-only. Provides one polite `fetch` wrapper (sets a `mailto`/User-Agent
 * per each source's etiquette), a small in-process cache keyed by request URL,
 * and the normalized shapes every client maps onto so the stitch step (F5) can
 * fuse them uniformly. No secret is read here -- these are all free, keyless
 * public APIs (OpenAlex CC0, ORCID public, Europe PMC, Crossref polite pool).
 *
 * Re-exports the four thin clients so callers import from `@/lib/scholarly`.
 */

/** Contact address for the polite pools (OpenAlex/Crossref) + User-Agent. */
export const CONTACT_EMAIL = process.env.OPENALEX_MAILTO ?? "onboarding@ensemble.studio";
export const USER_AGENT = `Ensemble/1.0 (profile-ingestion; mailto:${CONTACT_EMAIL})`;

/** Which open source produced a record (mirrors `profile_source_kind`, F5). */
export type ScholarlySourceKind = "openalex" | "orcid" | "europepmc" | "crossref";

/** Best-effort status for one source fetch, surfaced so a down source -> a
 *  partial (not failed) profile with a note (graceful degradation). */
export interface SourceNote {
  source: ScholarlySourceKind | "cv";
  ok: boolean;
  detail?: string;
}

/** A disambiguation candidate for the "Is this you?" step (T1). */
export interface ScholarlyAuthorHit {
  source: ScholarlySourceKind;
  id: string; // external id: OpenAlex author id or ORCID iD
  name: string;
  orcid: string | null;
  institution: string | null;
  city: string | null;
  country: string | null;
  topics: string[];
  worksCount: number | null;
  citedByCount: number | null;
  hIndex: number | null;
  raw: unknown;
}

/** One publication, normalized across sources (mirrors `Publication`). */
export interface ScholarlyWork {
  title: string;
  year: number | null;
  doi: string | null;
  venue: string | null;
  source: ScholarlySourceKind;
  /** MeSH descriptors (Europe PMC) -- medical depth for domain inference. */
  meshTerms?: string[];
  /** OpenAlex topic labels attached to the work. */
  topics?: string[];
}

/** Typed transport failure carrying the source + HTTP status for notes. */
export class ScholarlyError extends Error {
  constructor(
    public readonly source: ScholarlySourceKind,
    public readonly status: number | null,
    message: string,
  ) {
    super(message);
    this.name = "ScholarlyError";
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { at: number; value: unknown }>();

interface FetchOptions {
  source: ScholarlySourceKind;
  /** Append `mailto=` to the query (OpenAlex + Crossref polite pools). */
  mailtoParam?: boolean;
  timeoutMs?: number;
}

/**
 * Polite JSON GET against a public scholarly API. Sets a descriptive
 * User-Agent + Accept, bounds the request with a timeout, and throws a typed
 * {@link ScholarlyError} on transport failure or non-2xx so callers can record
 * a {@link SourceNote} and continue with a partial profile.
 */
export async function scholarlyFetch<T>(url: string, opts: FetchOptions): Promise<T> {
  const target = new URL(url);
  if (opts.mailtoParam) target.searchParams.set("mailto", CONTACT_EMAIL);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(target.toString(), {
      method: "GET",
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new ScholarlyError(opts.source, res.status, `${opts.source} responded ${res.status}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ScholarlyError) throw err;
    const detail = err instanceof Error ? err.message : String(err);
    throw new ScholarlyError(opts.source, null, `${opts.source} request failed: ${detail}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Cache a loader's result by `key` (request URL) for {@link CACHE_TTL_MS}. */
export async function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;
  const value = await loader();
  cache.set(key, { at: Date.now(), value });
  return value;
}

/**
 * Run one source-producing step, converting any failure into a recorded
 * {@link SourceNote} and a `null` result -- so a single source being down
 * never fails the whole ingest (F5 "degrade gracefully").
 */
export async function settle<T>(
  source: SourceNote["source"],
  notes: SourceNote[],
  fn: () => Promise<T>,
): Promise<T | null> {
  try {
    const value = await fn();
    notes.push({ source, ok: true });
    return value;
  } catch (err) {
    notes.push({ source, ok: false, detail: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

/** Strip the OpenAlex/ORCID URL prefix to a bare id (`A5023888391`, ORCID). */
export function bareId(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/^https?:\/\/[^/]+\/(?:orcid:)?/i, "").replace(/^orcid:/i, "") || null;
}

export * from "./openalex";
export * from "./orcid";
export * from "./europepmc";
export * from "./crossref";
