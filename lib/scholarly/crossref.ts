/**
 * Crossref client -- DOI / funding cross-check (F5). Joins the polite pool via
 * `mailto` + a descriptive User-Agent. Keyless REST.
 *
 * Docs shape: https://api.crossref.org/works
 */
import { bareId, cached, scholarlyFetch, type ScholarlyWork } from "./index";

const BASE = "https://api.crossref.org/works";

interface CrItem {
  DOI?: string;
  title?: string[];
  "container-title"?: string[];
  published?: { "date-parts"?: number[][] };
  "published-print"?: { "date-parts"?: number[][] };
  "published-online"?: { "date-parts"?: number[][] };
  author?: Array<{ given?: string; family?: string; ORCID?: string }>;
  funder?: Array<{ name?: string; DOI?: string }>;
}
interface CrList {
  message?: { items?: CrItem[] };
}
interface CrSingle {
  message?: CrItem;
}

function year(it: CrItem): number | null {
  const parts =
    it.published?.["date-parts"]?.[0] ??
    it["published-print"]?.["date-parts"]?.[0] ??
    it["published-online"]?.["date-parts"]?.[0];
  return parts?.[0] ?? null;
}

function toWork(it: CrItem): ScholarlyWork {
  return {
    title: it.title?.[0] ?? "",
    year: year(it),
    doi: bareId(it.DOI ?? null),
    venue: it["container-title"]?.[0] ?? null,
    source: "crossref",
  };
}

/** Enriched Crossref bundle: works + distinct funders (funding signal). */
export interface CrossrefProfile {
  works: ScholarlyWork[];
  funders: string[];
}

/** Search works by author name (polite pool). Returns up to `rows` (default 20). */
export async function searchCrossrefByAuthor(name: string, rows = 20): Promise<CrossrefProfile> {
  const url = new URL(BASE);
  url.searchParams.set("query.author", name);
  url.searchParams.set("rows", String(Math.min(rows, 50)));
  url.searchParams.set("select", "DOI,title,container-title,published,author,funder");
  const key = url.toString();
  const data = await cached(key, () =>
    scholarlyFetch<CrList>(key, { source: "crossref", mailtoParam: true }),
  );
  const items = data.message?.items ?? [];
  const works = items.map(toWork).filter((w) => w.title);
  const funders = Array.from(
    new Set(items.flatMap((i) => (i.funder ?? []).map((f) => f.name).filter((x): x is string => Boolean(x)))),
  );
  return { works, funders };
}

/** Resolve a single work by DOI (cross-checks a CV/link-provided DOI). */
export async function getCrossrefWork(doi: string): Promise<ScholarlyWork | null> {
  const clean = bareId(doi) ?? doi;
  const key = `${BASE}/${encodeURIComponent(clean)}`;
  try {
    const data = await cached(key, () =>
      scholarlyFetch<CrSingle>(key, { source: "crossref", mailtoParam: true }),
    );
    return data.message ? toWork(data.message) : null;
  } catch {
    return null;
  }
}
