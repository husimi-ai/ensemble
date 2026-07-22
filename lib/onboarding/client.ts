/**
 * Typed browser-side wrappers for the onboarding flow (T1, task 008).
 *
 * These are thin transport helpers only — every heavy step lives behind the
 * 006/007 route handlers. `resolveCandidates` / `ingestProfile` / `indexProfile`
 * POST JSON to their routes; `uploadCv` streams the file to the `cvs` Storage
 * bucket; `saveConfirmedProfile` writes the user-corrected profile (confirmed)
 * under RLS. Request/response shapes mirror the actual 006/007 contracts.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScholarlyAuthorHit, SourceNote } from "@/lib/scholarly";
import type { Confidence, Provenance, StitchedProfile } from "@/lib/profile/schema";

// --- /api/onboarding/resolve -------------------------------------------------
export interface ResolveRequest {
  name: string;
  institution?: string | null;
  orcid?: string | null;
}
export interface ResolveResponse {
  candidates: ScholarlyAuthorHit[];
  notes: SourceNote[];
}

// --- /api/onboarding/ingest --------------------------------------------------
export interface CvPayload {
  text?: string;
  pdfBase64?: string;
}
export interface IngestRequest {
  name: string;
  authorId?: string | null;
  orcid?: string | null;
  institution?: string | null;
  cv?: CvPayload | null;
  links?: string[] | null;
}
/** The ingest route returns the stitched profile plus a resolved institution id. */
export type IngestedProfile = StitchedProfile & { institutionId: string | null };
export interface IngestResponse {
  profileId: string;
  profile: IngestedProfile;
  provenance: Provenance;
  confidence: Confidence;
  sources: string[];
  notes: SourceNote[];
}

// --- /api/profile/index ------------------------------------------------------
export interface IndexResponse {
  profileId: string;
  embedding: unknown;
  classification: unknown;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data as { error?: string }).error ?? `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

/** "Is this you?" disambiguation — candidate authors for the given identity. */
export function resolveCandidates(body: ResolveRequest): Promise<ResolveResponse> {
  return postJson<ResolveResponse>("/api/onboarding/resolve", body);
}

/** Run the investigation pipeline against the confirmed anchor. */
export function ingestProfile(body: IngestRequest): Promise<IngestResponse> {
  return postJson<IngestResponse>("/api/onboarding/ingest", body);
}

/** Embed + role-classify the (confirmed) profile so it becomes matchable. */
export function indexProfile(profileId: string): Promise<IndexResponse> {
  return postJson<IndexResponse>("/api/profile/index", { profileId });
}

/** Read a PDF as base64 (no data-URL prefix); text files as UTF-8 text. */
export async function fileToCvPayload(file: File): Promise<CvPayload> {
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (isPdf) return { pdfBase64: await fileToBase64(file) };
  return { text: await file.text() };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("could not read file"));
    reader.readAsDataURL(file);
  });
}

/** Upload the CV to the `cvs` bucket under the user's folder; return its path. */
export async function uploadCv(
  supabase: SupabaseClient,
  userId: string,
  file: File,
): Promise<string> {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${userId}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from("cvs").upload(path, file, {
    upsert: true,
    contentType: file.type || "application/octet-stream",
  });
  if (error) throw new Error(error.message);
  return path;
}

/**
 * Persist the user-corrected profile with `confirmed = true` (GDPR Art. 16
 * rectification). Runs under RLS via the browser client — self rows only.
 * Maps the camelCase stitch schema back onto the `profiles` columns.
 */
export async function saveConfirmedProfile(
  supabase: SupabaseClient,
  profileId: string,
  profile: IngestedProfile,
  provenance: Provenance,
  confidence: Confidence,
): Promise<void> {
  const payload: Record<string, unknown> = {
    headline: profile.headline,
    bio: profile.bio,
    research_topics: profile.topics,
    skills: profile.skills,
    publications: profile.publications,
    data_resources: profile.resources,
    orcid: profile.orcid,
    openalex_id: profile.openalexId,
    city: profile.city,
    country: profile.country,
    lat: profile.latitude,
    long: profile.longitude,
    provenance,
    confidence,
    confirmed: true,
  };
  const { error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", profileId);
  if (error) throw new Error(error.message);
}
