/**
 * OpenAlex client (CC0) -- the primary source: disambiguated authors, works,
 * topics, institutions + geo, and citation metrics (F5). Free/keyless; we join
 * the polite pool with a `mailto`. Cached by request URL (index `cached`).
 *
 * Docs shape: https://api.openalex.org (authors, works, institutions). Fields
 * used are the documented subset; unknowns are tolerated (optional types).
 */
import {
  bareId,
  cached,
  scholarlyFetch,
  type ScholarlyAuthorHit,
  type ScholarlyWork,
} from "./index";

const BASE = "https://api.openalex.org";

interface OaTopic {
  display_name?: string;
  subfield?: { display_name?: string };
  field?: { display_name?: string };
}
interface OaInstitution {
  id?: string;
  display_name?: string;
  ror?: string;
  country_code?: string;
  geo?: { city?: string; country?: string; latitude?: number; longitude?: number };
}
interface OaAuthor {
  id?: string;
  display_name?: string;
  orcid?: string | null;
  works_count?: number;
  cited_by_count?: number;
  summary_stats?: { h_index?: number; i10_index?: number };
  last_known_institutions?: OaInstitution[];
  topics?: OaTopic[];
  x_concepts?: { display_name?: string }[];
}
interface OaWork {
  id?: string;
  doi?: string | null;
  display_name?: string | null;
  title?: string | null;
  publication_year?: number | null;
  primary_location?: { source?: { display_name?: string | null } | null } | null;
  topics?: OaTopic[];
}
interface OaList<T> {
  results?: T[];
}

/** Enriched OpenAlex bundle consumed by the stitch step. */
export interface OpenAlexProfile {
  author: ScholarlyAuthorHit;
  works: ScholarlyWork[];
  topics: string[];
}

function authorTopics(a: OaAuthor): string[] {
  const fromTopics = (a.topics ?? [])
    .map((t) => t.display_name)
    .filter((x): x is string => Boolean(x));
  if (fromTopics.length) return dedupe(fromTopics);
  return dedupe((a.x_concepts ?? []).map((c) => c.display_name).filter((x): x is string => Boolean(x)));
}

function dedupe(xs: string[]): string[] {
  return Array.from(new Set(xs));
}

function toAuthorHit(a: OaAuthor): ScholarlyAuthorHit {
  const inst = a.last_known_institutions?.[0];
  return {
    source: "openalex",
    id: bareId(a.id) ?? a.id ?? "",
    name: a.display_name ?? "",
    orcid: bareId(a.orcid ?? null),
    institution: inst?.display_name ?? null,
    city: inst?.geo?.city ?? null,
    country: inst?.geo?.country ?? inst?.country_code ?? null,
    topics: authorTopics(a).slice(0, 12),
    worksCount: a.works_count ?? null,
    citedByCount: a.cited_by_count ?? null,
    hIndex: a.summary_stats?.h_index ?? null,
    raw: a,
  };
}

function toWork(w: OaWork): ScholarlyWork {
  return {
    title: w.title ?? w.display_name ?? "",
    year: w.publication_year ?? null,
    doi: bareId(w.doi ?? null),
    venue: w.primary_location?.source?.display_name ?? null,
    source: "openalex",
    topics: dedupe((w.topics ?? []).map((t) => t.display_name).filter((x): x is string => Boolean(x))),
  };
}

/** Search authors by name (optionally scoped to an institution name). Top 5. */
export async function searchOpenAlexAuthors(
  name: string,
  institution?: string,
): Promise<ScholarlyAuthorHit[]> {
  const url = new URL(`${BASE}/authors`);
  url.searchParams.set("search", name);
  url.searchParams.set("per-page", "5");
  if (institution) url.searchParams.set("filter", `affiliations.institution.display_name.search:${institution}`);
  const key = url.toString();
  const data = await cached(key, () =>
    scholarlyFetch<OaList<OaAuthor>>(key, { source: "openalex", mailtoParam: true }),
  );
  return (data.results ?? []).map(toAuthorHit);
}

/** Fetch a single author by OpenAlex id (`A123...`) or ORCID iD. */
export async function getOpenAlexAuthor(idOrOrcid: string): Promise<ScholarlyAuthorHit | null> {
  const ref = /^\d{4}-\d{4}-\d{4}-\d{3}[\dxX]$/.test(idOrOrcid)
    ? `https://orcid.org/${idOrOrcid}`
    : bareId(idOrOrcid) ?? idOrOrcid;
  const key = `${BASE}/authors/${encodeURIComponent(ref)}`;
  try {
    const a = await cached(key, () =>
      scholarlyFetch<OaAuthor>(key, { source: "openalex", mailtoParam: true }),
    );
    return toAuthorHit(a);
  } catch {
    return null;
  }
}

/** Most-cited works for an author id (default 25). */
export async function getOpenAlexWorks(authorId: string, limit = 25): Promise<ScholarlyWork[]> {
  const id = bareId(authorId) ?? authorId;
  const url = new URL(`${BASE}/works`);
  url.searchParams.set("filter", `author.id:${id}`);
  url.searchParams.set("sort", "cited_by_count:desc");
  url.searchParams.set("per-page", String(Math.min(limit, 50)));
  const key = url.toString();
  const data = await cached(key, () =>
    scholarlyFetch<OaList<OaWork>>(key, { source: "openalex", mailtoParam: true }),
  );
  return (data.results ?? []).map(toWork);
}

/** Resolve an institution name -> id/ROR/geo (proximity tiers, T3). */
export async function searchOpenAlexInstitution(name: string): Promise<{
  id: string | null;
  name: string;
  ror: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
} | null> {
  const url = new URL(`${BASE}/institutions`);
  url.searchParams.set("search", name);
  url.searchParams.set("per-page", "1");
  const key = url.toString();
  const data = await cached(key, () =>
    scholarlyFetch<OaList<OaInstitution>>(key, { source: "openalex", mailtoParam: true }),
  );
  const inst = data.results?.[0];
  if (!inst) return null;
  return {
    id: bareId(inst.id ?? null),
    name: inst.display_name ?? name,
    ror: inst.ror ?? null,
    city: inst.geo?.city ?? null,
    country: inst.geo?.country ?? inst.country_code ?? null,
    latitude: inst.geo?.latitude ?? null,
    longitude: inst.geo?.longitude ?? null,
  };
}

/** Author + works + merged topics for the confirmed anchor. */
export async function fetchOpenAlexProfile(idOrOrcid: string): Promise<OpenAlexProfile | null> {
  const author = await getOpenAlexAuthor(idOrOrcid);
  if (!author) return null;
  const works = author.id ? await getOpenAlexWorks(author.id) : [];
  const topics = dedupe([...author.topics, ...works.flatMap((w) => w.topics ?? [])]).slice(0, 20);
  return { author, works, topics };
}
