/**
 * LLM stitch (T1): fuse ORCID / OpenAlex / Europe PMC / Crossref / CV into one
 * profile with **per-field provenance + confidence**. Rules (F5):
 *  - prefer self-asserted (ORCID, CV) over inferred (OpenAlex topics);
 *  - infer research *domain* + *resources controlled*, NEVER personal health;
 *  - dedupe publications across sources.
 *
 * Uses the Anthropic SDK when `ANTHROPIC_API_KEY` is set; otherwise degrades to
 * a deterministic rule-based merge so the pipeline never blocks on the LLM.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type {
  CrossrefProfile,
  EuropePmcProfile,
  OpenAlexProfile,
  OrcidProfile,
  ScholarlyWork,
} from "@/lib/scholarly";
import {
  StitchResultSchema,
  type Confidence,
  type Provenance,
  type Publication,
  type StitchResult,
  type CvExtraction,
} from "./schema";

const STITCH_MODEL = "claude-sonnet-5";
const CONF_FACT = 0.98; // deterministic identifiers
const CONF_SELF = 0.9; // ORCID / CV self-asserted
const CONF_INFERRED = 0.6; // OpenAlex / Europe PMC inferred

export interface StitchSources {
  openalex: OpenAlexProfile | null;
  orcid: OrcidProfile | null;
  europepmc: EuropePmcProfile | null;
  crossref: CrossrefProfile | null;
  cv: CvExtraction | null;
}

export interface StitchInput {
  name: string;
  sources: StitchSources;
}

const SYSTEM = [
  "You fuse a researcher's public scholarly records and CV into ONE profile.",
  "Prefer self-asserted sources (ORCID, CV) over inferred ones (OpenAlex topics)",
  "when they conflict. Deduplicate publications across sources by DOI then title.",
  "Infer the research DOMAIN and the data/compute RESOURCES the person controls",
  "at a domain level only. NEVER infer, extract, or record the person's own",
  "health or any special-category personal data (GDPR Art. 9).",
  "For every profile field set `provenance` to the source it came from and",
  "`confidence` in [0,1] (self-asserted ~0.9, inferred ~0.6, identifiers ~0.98).",
  "Use null / empty arrays for anything unsupported by the sources.",
].join(" ");

/** Merge + dedupe works from every source into `Publication[]` (cap 40). */
function collectPublications(sources: StitchSources): Publication[] {
  const works: Publication[] = [];
  const push = (w: ScholarlyWork) =>
    works.push({ title: w.title, year: w.year, doi: w.doi, venue: w.venue });
  sources.orcid?.works.forEach(push);
  sources.openalex?.works.forEach(push);
  sources.europepmc?.works.forEach(push);
  sources.crossref?.works.forEach(push);
  sources.cv?.publications.forEach((p) => works.push(p));

  const withDoiFirst = [...works].sort((a, b) => (a.doi ? 0 : 1) - (b.doi ? 0 : 1));
  const seen = new Map<string, Publication>();
  for (const w of withDoiFirst) {
    if (!w.title) continue;
    const key = (w.doi ?? w.title).toLowerCase().trim();
    if (!seen.has(key)) seen.set(key, w);
  }
  return Array.from(seen.values()).slice(0, 40);
}

function uniq(xs: string[]): string[] {
  return Array.from(new Set(xs.filter(Boolean)));
}

/** Compact, source-labeled payload for the LLM (keeps prompt tokens bounded). */
function buildPayload(input: StitchInput): string {
  const s = input.sources;
  return JSON.stringify({
    name: input.name,
    orcid: s.orcid && {
      orcid: s.orcid.orcid,
      biography: s.orcid.biography,
      employments: s.orcid.employments.slice(0, 5),
      educations: s.orcid.educations.slice(0, 5),
    },
    openalex: s.openalex && {
      id: s.openalex.author.id,
      institution: s.openalex.author.institution,
      city: s.openalex.author.city,
      country: s.openalex.author.country,
      topics: s.openalex.topics,
      hIndex: s.openalex.author.hIndex,
    },
    europePmcMesh: s.europepmc?.meshTerms.slice(0, 30) ?? [],
    crossrefFunders: s.crossref?.funders.slice(0, 15) ?? [],
    cv: s.cv,
    publications: collectPublications(input.sources),
  });
}

/** Backfill factual identifiers the model may have dropped (they are certain). */
function backfillIds(result: StitchResult, sources: StitchSources): StitchResult {
  const orcid = sources.orcid?.orcid ?? sources.cv?.orcid ?? sources.openalex?.author.orcid ?? null;
  const openalexId = sources.openalex?.author.id ?? null;
  if (!result.profile.orcid && orcid) {
    result.profile.orcid = orcid;
    result.provenance.orcid = sources.orcid ? "orcid" : sources.cv?.orcid ? "cv" : "openalex";
    result.confidence.orcid = CONF_FACT;
  }
  if (!result.profile.openalexId && openalexId) {
    result.profile.openalexId = openalexId;
    result.provenance.openalexId = "openalex";
    result.confidence.openalexId = CONF_FACT;
  }
  return result;
}

/** Rule-based fusion used when the LLM is unavailable (graceful degradation). */
export function deterministicStitch(input: StitchInput): StitchResult {
  const { orcid, openalex, europepmc, cv } = input.sources;
  const topics = uniq([
    ...(cv?.topics ?? []),
    ...(openalex?.topics ?? []),
    ...(europepmc?.meshTerms ?? []),
  ]).slice(0, 20);
  const employment = orcid?.employments[0];

  const profile = {
    headline: cv?.headline ?? null,
    bio: cv?.bio ?? orcid?.biography ?? null,
    topics,
    skills: uniq(cv?.skills ?? []),
    publications: collectPublications(input.sources),
    resources: uniq(cv?.resources ?? []),
    orcid: orcid?.orcid ?? cv?.orcid ?? openalex?.author.orcid ?? null,
    openalexId: openalex?.author.id ?? null,
    institutionName: cv?.institutionName ?? employment?.organization ?? openalex?.author.institution ?? null,
    city: cv?.city ?? employment?.city ?? openalex?.author.city ?? null,
    country: cv?.country ?? employment?.country ?? openalex?.author.country ?? null,
    latitude: null as number | null,
    longitude: null as number | null,
  };

  const src = (self: boolean, present: unknown, fallback: Provenance[keyof Provenance]) =>
    present == null ? null : self ? (cv ? "cv" : "orcid") : fallback;

  const provenance: Provenance = {
    headline: cv?.headline != null ? "cv" : null,
    bio: cv?.bio != null ? "cv" : orcid?.biography != null ? "orcid" : null,
    topics: topics.length ? (cv?.topics?.length ? "cv" : openalex ? "openalex" : "europepmc") : null,
    skills: profile.skills.length ? "cv" : null,
    publications: profile.publications.length ? (orcid ? "orcid" : openalex ? "openalex" : "crossref") : null,
    resources: profile.resources.length ? "cv" : null,
    orcid: profile.orcid ? (orcid ? "orcid" : cv?.orcid ? "cv" : "openalex") : null,
    openalexId: profile.openalexId ? "openalex" : null,
    institutionName: src(Boolean(cv?.institutionName ?? employment), profile.institutionName, "openalex"),
    city: src(Boolean(cv?.city ?? employment?.city), profile.city, "openalex"),
    country: src(Boolean(cv?.country ?? employment?.country), profile.country, "openalex"),
    latitude: null,
    longitude: null,
  };

  const conf = (p: Provenance[keyof Provenance]): number | null =>
    p == null ? null : p === "cv" || p === "orcid" ? CONF_SELF : CONF_INFERRED;
  const confidence: Confidence = {
    headline: conf(provenance.headline),
    bio: conf(provenance.bio),
    topics: conf(provenance.topics),
    skills: conf(provenance.skills),
    publications: conf(provenance.publications),
    resources: conf(provenance.resources),
    orcid: provenance.orcid ? CONF_FACT : null,
    openalexId: provenance.openalexId ? CONF_FACT : null,
    institutionName: conf(provenance.institutionName),
    city: conf(provenance.city),
    country: conf(provenance.country),
    latitude: null,
    longitude: null,
  };

  return { profile, provenance, confidence };
}

/**
 * Stitch the fetched sources into one provenance-tagged profile. Uses the LLM
 * when configured, else a deterministic merge. Factual identifiers (ORCID /
 * OpenAlex id) are always backfilled from the confirmed anchor.
 */
export async function stitchProfile(input: StitchInput): Promise<StitchResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return deterministicStitch(input);
  }
  const client = new Anthropic();
  const message = await client.messages.parse({
    model: STITCH_MODEL,
    max_tokens: 8192,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Fuse these source records into one profile.\n\n${buildPayload(input)}`,
      },
    ],
    output_config: { format: zodOutputFormat(StitchResultSchema) },
  });
  if (!message.parsed_output) return deterministicStitch(input);
  return backfillIds(message.parsed_output, input.sources);
}
