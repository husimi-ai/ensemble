/**
 * Europe PMC client -- medical depth (F5): PubMed + preprints, plus **MeSH**
 * descriptors that let the stitch step infer the *research domain* (never the
 * person's own health -- Art. 9 special category). Keyless REST; `resultType=core`
 * returns the MeSH heading list.
 *
 * Docs shape: https://www.ebi.ac.uk/europepmc/webservices/rest/search
 */
import { cached, scholarlyFetch, type ScholarlyWork } from "./index";

const BASE = "https://www.ebi.ac.uk/europepmc/webservices/rest/search";

interface EpmcMesh {
  descriptorName?: string;
}
interface EpmcResult {
  id?: string;
  source?: string;
  pmid?: string;
  doi?: string | null;
  title?: string | null;
  authorString?: string | null;
  journalTitle?: string | null;
  pubYear?: string | null;
  meshHeadingList?: { meshHeading?: EpmcMesh[] };
}
interface EpmcResponse {
  hitCount?: number;
  resultList?: { result?: EpmcResult[] };
}

/** Works + the union of their MeSH descriptors for one researcher. */
export interface EuropePmcProfile {
  works: ScholarlyWork[];
  meshTerms: string[];
}

function toWork(r: EpmcResult): ScholarlyWork {
  return {
    title: r.title ?? "",
    year: r.pubYear ? Number(r.pubYear) || null : null,
    doi: r.doi ?? null,
    venue: r.journalTitle ?? null,
    source: "europepmc",
    meshTerms: (r.meshHeadingList?.meshHeading ?? [])
      .map((m) => m.descriptorName)
      .filter((x): x is string => Boolean(x)),
  };
}

/**
 * Search Europe PMC by ORCID iD (preferred, precise) or free-text author name.
 * Returns up to `limit` core records (default 25) with MeSH.
 */
export async function fetchEuropePmcProfile(
  params: { orcid?: string | null; name?: string | null },
  limit = 25,
): Promise<EuropePmcProfile> {
  const query = params.orcid
    ? `AUTHORID:"${params.orcid}"`
    : params.name
      ? `AUTH:"${params.name}"`
      : null;
  if (!query) return { works: [], meshTerms: [] };

  const url = new URL(BASE);
  url.searchParams.set("query", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("resultType", "core");
  url.searchParams.set("pageSize", String(Math.min(limit, 100)));
  const key = url.toString();

  const data = await cached(key, () =>
    scholarlyFetch<EpmcResponse>(key, { source: "europepmc" }),
  );
  const works = (data.resultList?.result ?? []).map(toWork);
  const meshTerms = Array.from(new Set(works.flatMap((w) => w.meshTerms ?? [])));
  return { works, meshTerms };
}
