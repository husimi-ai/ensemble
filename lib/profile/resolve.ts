/**
 * Identity resolution (T1): name (+ institution) or an ORCID iD -> candidate
 * author profiles for the "Is this you?" disambiguation step. Disambiguate
 * primarily via ORCID iD (authoritative anchor); otherwise an OpenAlex author
 * search on name (+ institution) surfacing the top matches. Degrades gracefully
 * -- a source being down yields a partial candidate list with a note (F5).
 */
import {
  fetchOrcidProfile,
  getOpenAlexAuthor,
  searchOpenAlexAuthors,
  settle,
  type ScholarlyAuthorHit,
  type SourceNote,
} from "@/lib/scholarly";

export interface ResolveInput {
  name: string;
  institution?: string | null;
  orcid?: string | null;
}

export interface ResolveOutput {
  candidates: ScholarlyAuthorHit[];
  notes: SourceNote[];
}

/** Dedupe candidates, preferring an ORCID iD then the source-scoped id. */
function dedupe(hits: ScholarlyAuthorHit[]): ScholarlyAuthorHit[] {
  const seen = new Map<string, ScholarlyAuthorHit>();
  for (const hit of hits) {
    const key = hit.orcid ?? `${hit.source}:${hit.id}`;
    if (!seen.has(key)) seen.set(key, hit);
  }
  return Array.from(seen.values());
}

/**
 * Produce disambiguation candidates. With an ORCID iD, resolve the
 * authoritative record plus the OpenAlex author keyed by that iD; otherwise
 * search OpenAlex by name (+ institution) and return the top matches.
 */
export async function resolveCandidates(input: ResolveInput): Promise<ResolveOutput> {
  const notes: SourceNote[] = [];
  const hits: ScholarlyAuthorHit[] = [];

  if (input.orcid) {
    const orcid = await settle("orcid", notes, () => fetchOrcidProfile(input.orcid!));
    if (orcid) hits.push(orcid.authorHit);
    const byOrcid = await settle("openalex", notes, () => getOpenAlexAuthor(input.orcid!));
    if (byOrcid) hits.push(byOrcid);
  }

  const byName = await settle("openalex", notes, () =>
    searchOpenAlexAuthors(input.name, input.institution ?? undefined),
  );
  if (byName) hits.push(...byName.slice(0, 3));

  return { candidates: dedupe(hits), notes };
}
