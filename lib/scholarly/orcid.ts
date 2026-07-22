/**
 * ORCID public API client -- the authoritative identity anchor (F5): name,
 * biography, employment + education affiliations, and the works list. Keyless
 * public read (`pub.orcid.org` v3.0). A production deployment may swap in a
 * read-public token via `ORCID_TOKEN`; none is required for these endpoints.
 *
 * The ORCID record is deeply nested; we type only the documented subset used.
 */
import {
  bareId,
  cached,
  scholarlyFetch,
  type ScholarlyAuthorHit,
  type ScholarlyWork,
} from "./index";

const BASE = "https://pub.orcid.org/v3.0";

interface OrValue {
  value?: string;
}
interface OrDate {
  year?: OrValue;
}
interface OrOrg {
  name?: string;
  address?: { city?: string; region?: string; country?: string };
}
interface OrAffiliationSummary {
  "organization"?: OrOrg;
  "role-title"?: string | null;
  "department-name"?: string | null;
  "start-date"?: OrDate | null;
  "end-date"?: OrDate | null;
}
interface OrAffiliationGroup {
  summaries?: Array<{
    "employment-summary"?: OrAffiliationSummary;
    "education-summary"?: OrAffiliationSummary;
  }>;
}
interface OrExternalId {
  "external-id-type"?: string;
  "external-id-value"?: string;
}
interface OrWorkSummary {
  title?: { title?: OrValue };
  "publication-date"?: OrDate | null;
  "journal-title"?: OrValue | null;
  "external-ids"?: { "external-id"?: OrExternalId[] };
}
interface OrRecord {
  "orcid-identifier"?: { path?: string };
  person?: {
    name?: { "given-names"?: OrValue; "family-name"?: OrValue; "credit-name"?: OrValue };
    biography?: { content?: string | null } | null;
  };
  "activities-summary"?: {
    employments?: { "affiliation-group"?: OrAffiliationGroup[] };
    educations?: { "affiliation-group"?: OrAffiliationGroup[] };
    works?: { group?: Array<{ "work-summary"?: OrWorkSummary[] }> };
  };
}

/** A self-asserted affiliation (employment or education). */
export interface OrcidAffiliation {
  organization: string | null;
  role: string | null;
  department: string | null;
  city: string | null;
  country: string | null;
  startYear: number | null;
  endYear: number | null;
}

/** Enriched ORCID bundle consumed by the stitch step. */
export interface OrcidProfile {
  orcid: string;
  name: string;
  biography: string | null;
  employments: OrcidAffiliation[];
  educations: OrcidAffiliation[];
  works: ScholarlyWork[];
  authorHit: ScholarlyAuthorHit;
}

function fullName(rec: OrRecord): string {
  const n = rec.person?.name;
  const credit = n?.["credit-name"]?.value;
  if (credit) return credit;
  return [n?.["given-names"]?.value, n?.["family-name"]?.value].filter(Boolean).join(" ").trim();
}

function toAffiliations(groups: OrAffiliationGroup[] | undefined, kind: "employment" | "education"): OrcidAffiliation[] {
  const out: OrcidAffiliation[] = [];
  for (const g of groups ?? []) {
    for (const s of g.summaries ?? []) {
      const sum = kind === "employment" ? s["employment-summary"] : s["education-summary"];
      if (!sum) continue;
      out.push({
        organization: sum.organization?.name ?? null,
        role: sum["role-title"] ?? null,
        department: sum["department-name"] ?? null,
        city: sum.organization?.address?.city ?? null,
        country: sum.organization?.address?.country ?? null,
        startYear: numYear(sum["start-date"]),
        endYear: numYear(sum["end-date"]),
      });
    }
  }
  return out;
}

function numYear(d: OrDate | null | undefined): number | null {
  const y = d?.year?.value;
  return y ? Number(y) || null : null;
}

function toWorks(rec: OrRecord): ScholarlyWork[] {
  const groups = rec["activities-summary"]?.works?.group ?? [];
  const works: ScholarlyWork[] = [];
  for (const g of groups) {
    const s = g["work-summary"]?.[0];
    if (!s) continue;
    const doi = (s["external-ids"]?.["external-id"] ?? []).find(
      (e) => e["external-id-type"]?.toLowerCase() === "doi",
    )?.["external-id-value"];
    works.push({
      title: s.title?.title?.value ?? "",
      year: numYear(s["publication-date"]),
      doi: doi ? bareId(doi) : null,
      venue: s["journal-title"]?.value ?? null,
      source: "orcid",
    });
  }
  return works.filter((w) => w.title);
}

/** Fetch and normalize a full public ORCID record. */
export async function fetchOrcidProfile(orcid: string): Promise<OrcidProfile | null> {
  const id = bareId(orcid) ?? orcid;
  const key = `${BASE}/${id}/record`;
  const rec = await cached(key, () => scholarlyFetch<OrRecord>(key, { source: "orcid" }));
  const path = rec["orcid-identifier"]?.path ?? id;
  const employments = toAffiliations(rec["activities-summary"]?.employments?.["affiliation-group"], "employment");
  const educations = toAffiliations(rec["activities-summary"]?.educations?.["affiliation-group"], "education");
  const current = employments[0];
  const name = fullName(rec);
  const authorHit: ScholarlyAuthorHit = {
    source: "orcid",
    id: path,
    name,
    orcid: path,
    institution: current?.organization ?? educations[0]?.organization ?? null,
    city: current?.city ?? null,
    country: current?.country ?? null,
    topics: [],
    worksCount: rec["activities-summary"]?.works?.group?.length ?? null,
    citedByCount: null,
    hIndex: null,
    raw: rec,
  };
  return {
    orcid: path,
    name,
    biography: rec.person?.biography?.content ?? null,
    employments,
    educations,
    works: toWorks(rec),
    authorHit,
  };
}
