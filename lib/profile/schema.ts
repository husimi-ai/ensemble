/**
 * Target profile schema (Zod) -- the shape the LLM stitch + CV parse emit and
 * the ingest route persists. Mirrors the `profiles` columns from migration 001
 * (research_topics, skills, publications, data_resources, orcid, openalex_id,
 * institution, city/country, lat/long) in camelCase.
 *
 * Every field carries **per-field provenance + confidence** for GDPR Art. 14/16
 * review (F5). Provenance/confidence are **explicit field-keyed objects** (not
 * `z.record`) so the schema is valid for Anthropic structured outputs, and all
 * properties are `.nullable()` (required, may be null) for strict validity.
 */
import { z } from "zod";

/** Where a stitched field came from (open source, CV, or user-asserted). */
export const SourceKindSchema = z.enum([
  "openalex",
  "orcid",
  "europepmc",
  "crossref",
  "cv",
  "user",
]);
export type SourceKind = z.infer<typeof SourceKindSchema>;

/** One publication (mirrors `Publication` in lib/types). */
export const PublicationSchema = z.object({
  title: z.string(),
  year: z.number().nullable(),
  doi: z.string().nullable(),
  venue: z.string().nullable(),
});
export type Publication = z.infer<typeof PublicationSchema>;

/** The investigated, provenance-tagged picture of a person (T1). */
export const ProfileSchema = z.object({
  /** One-line professional headline. */
  headline: z.string().nullable(),
  /** Short professional biography. */
  bio: z.string().nullable(),
  /** Research topics / concepts (research_topics). */
  topics: z.array(z.string()),
  /** Methods / technical skills. */
  skills: z.array(z.string()),
  publications: z.array(PublicationSchema),
  /** Research data / compute they may control (data_resources) -- domain-level
   *  only; NEVER the person's own health data (Art. 9 special category). */
  resources: z.array(z.string()),
  orcid: z.string().nullable(),
  openalexId: z.string().nullable(),
  institutionName: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
});
export type StitchedProfile = z.infer<typeof ProfileSchema>;

/** The profile field names carrying provenance/confidence. */
export const PROFILE_FIELDS = [
  "headline",
  "bio",
  "topics",
  "skills",
  "publications",
  "resources",
  "orcid",
  "openalexId",
  "institutionName",
  "city",
  "country",
  "latitude",
  "longitude",
] as const;

/** Per-field provenance: which source produced each field (null if unset). */
export const ProvenanceSchema = z.object({
  headline: SourceKindSchema.nullable(),
  bio: SourceKindSchema.nullable(),
  topics: SourceKindSchema.nullable(),
  skills: SourceKindSchema.nullable(),
  publications: SourceKindSchema.nullable(),
  resources: SourceKindSchema.nullable(),
  orcid: SourceKindSchema.nullable(),
  openalexId: SourceKindSchema.nullable(),
  institutionName: SourceKindSchema.nullable(),
  city: SourceKindSchema.nullable(),
  country: SourceKindSchema.nullable(),
  latitude: SourceKindSchema.nullable(),
  longitude: SourceKindSchema.nullable(),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

/** Per-field extraction confidence in [0,1] (null if unset). */
export const ConfidenceSchema = z.object({
  headline: z.number().nullable(),
  bio: z.number().nullable(),
  topics: z.number().nullable(),
  skills: z.number().nullable(),
  publications: z.number().nullable(),
  resources: z.number().nullable(),
  orcid: z.number().nullable(),
  openalexId: z.number().nullable(),
  institutionName: z.number().nullable(),
  city: z.number().nullable(),
  country: z.number().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
});
export type Confidence = z.infer<typeof ConfidenceSchema>;

/** The complete LLM stitch output: fused profile + provenance + confidence. */
export const StitchResultSchema = z.object({
  profile: ProfileSchema,
  provenance: ProvenanceSchema,
  confidence: ConfidenceSchema,
});
export type StitchResult = z.infer<typeof StitchResultSchema>;

/** What the LLM extracts from a CV/resume (self-asserted, high-trust). */
export const CvExtractionSchema = z.object({
  name: z.string().nullable(),
  headline: z.string().nullable(),
  bio: z.string().nullable(),
  topics: z.array(z.string()),
  skills: z.array(z.string()),
  publications: z.array(PublicationSchema),
  resources: z.array(z.string()),
  orcid: z.string().nullable(),
  institutionName: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
});
export type CvExtraction = z.infer<typeof CvExtractionSchema>;
