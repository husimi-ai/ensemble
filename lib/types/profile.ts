/**
 * People + their investigated profiles. Mirrors `users`, `profiles`,
 * `profile_sources` (task 001, migration `0002_core_entities.sql`).
 * Every inferred profile fact carries per-field provenance + confidence for
 * GDPR Art. 14/16 review (F5). The `embedding halfvec(1024)` column is
 * DB/pgvector-only and is intentionally not surfaced in TS.
 */

/** Account/auth row. Table `users`. */
export interface User {
  id: string;
  email: string;
  name: string;
  profession: string | null;
  city: string | null;
  createdAt: string;
}

/** Assigned role from LLM classification (T1). Column `profiles.role`. */
export type ProfileRole = "problem_identifier" | "builder" | "researcher";

/** A source-fetch kind for one provided link/CV. Column `profile_sources.kind`. */
export type ProfileSourceKind =
  | "openalex"
  | "orcid"
  | "europepmc"
  | "crossref"
  | "cv"
  | "linkedin";

/** Per-field provenance: profile field name -> the `ProfileSource` id it came from. */
export type FieldProvenance = Record<string, string>;

/** Per-field extraction confidence: profile field name -> score in [0, 1]. */
export type FieldConfidence = Record<string, number>;

/** A single publication extracted for a profile (part of `profiles`). */
export interface Publication {
  title: string;
  year: number | null;
  doi: string | null;
  venue: string | null;
}

/**
 * The investigated picture of a user (1:1 with {@link User}). Table `profiles`.
 * DB mapping: `userId`<->`user_id`, `institutionId`<->`institution_id`,
 * `facilityId`<->`facility_id`, `latitude`/`longitude`<->`lat`/`long`,
 * `roleConfidence`<->`role_confidence`, jsonb `provenance`/`confidence`.
 */
export interface Profile {
  id: string;
  userId: string;
  topics: string[];
  publications: Publication[];
  skills: string[];
  resources: string[];
  institutionId: string | null;
  facilityId: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  role: ProfileRole | null;
  roleConfidence: number | null;
  confirmed: boolean;
  provenance: FieldProvenance;
  confidence: FieldConfidence;
  createdAt: string;
  updatedAt: string;
}

/**
 * A provided link or CV and what was fetched from it, kept for provenance +
 * re-ingest (F5). Table `profile_sources`. `ref` is the url / external id /
 * storage path; `raw` is the cached upstream payload.
 */
export interface ProfileSource {
  id: string;
  profileId: string;
  kind: ProfileSourceKind;
  ref: string;
  fetchedAt: string | null;
  raw: unknown;
}
