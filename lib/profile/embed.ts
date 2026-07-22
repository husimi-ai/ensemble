/**
 * Profile -> embedding (T3, F7). Compose one text document from the stitched
 * profile (headline, bio, research topics, skills, publication titles, controlled
 * data/resources, institution + place) and embed it with Voyage-3.5, then upsert
 * the 1024-dim vector into `profiles.embedding` (`halfvec(1024)`).
 *
 * Recompute only on profile edit (the route's concern). If Voyage is unconfigured
 * the embedding is skipped and reported -- a null embedding is a valid, recomputable
 * state, not a failure (F7). Server-only; reads/writes under the caller's RLS.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  VOYAGE_DIMS,
  VoyageConfigError,
  embedText,
  isVoyageConfigured,
  toVectorLiteral,
} from "@/lib/embeddings";

/** Publication shape as stored in `profiles.publications` (jsonb). */
interface PublicationRow {
  title?: string | null;
}

/** The columns of `profiles` that feed the embedding text. */
interface EmbeddableProfile {
  headline: string | null;
  bio: string | null;
  research_topics: string[] | null;
  skills: string[] | null;
  publications: PublicationRow[] | null;
  data_resources: string[] | null;
  city: string | null;
  country: string | null;
  institutions: { name: string | null } | null;
}

const PROFILE_SELECT =
  "headline,bio,research_topics,skills,publications,data_resources,city,country,institutions(name)";

/** Max publication titles to include (keeps the embedded document bounded). */
const MAX_PUB_TITLES = 40;

export interface EmbedProfileResult {
  embedded: boolean;
  dims: number;
  /** Present when embedding was skipped (unconfigured) or failed softly. */
  note?: string;
}

function line(label: string, value: string): string {
  return value.trim() ? `${label}: ${value.trim()}` : "";
}

function joinList(xs: string[] | null | undefined, sep = ", "): string {
  return (xs ?? []).map((x) => x?.trim()).filter(Boolean).join(sep);
}

/**
 * Compose the labeled text document embedded for a profile. Pure + deterministic
 * so the same profile always yields the same input (stable vectors across runs).
 */
export function composeProfileText(p: EmbeddableProfile): string {
  const pubTitles = (p.publications ?? [])
    .map((pub) => pub?.title?.trim())
    .filter((t): t is string => Boolean(t))
    .slice(0, MAX_PUB_TITLES);

  const place = [p.institutions?.name, p.city, p.country]
    .map((x) => x?.trim())
    .filter(Boolean)
    .join(", ");

  return [
    line("Headline", p.headline ?? ""),
    line("Bio", p.bio ?? ""),
    line("Research topics", joinList(p.research_topics)),
    line("Skills", joinList(p.skills)),
    line("Publications", pubTitles.join("; ")),
    line("Data and resources", joinList(p.data_resources)),
    line("Affiliation", place),
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Read a profile, embed it with Voyage-3.5, and upsert the vector into
 * `profiles.embedding`. Returns whether an embedding was written; a missing
 * Voyage key or an empty profile yields `embedded: false` with a note (no throw).
 */
export async function embedProfile(
  supabase: SupabaseClient,
  profileId: string,
): Promise<EmbedProfileResult> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", profileId)
    .single();
  if (error || !data) {
    return { embedded: false, dims: VOYAGE_DIMS, note: "profile not found" };
  }

  const text = composeProfileText(data as unknown as EmbeddableProfile);
  if (!text.trim()) {
    return { embedded: false, dims: VOYAGE_DIMS, note: "empty profile (nothing to embed)" };
  }
  if (!isVoyageConfigured()) {
    return { embedded: false, dims: VOYAGE_DIMS, note: "VOYAGE_API_KEY not set; embedding skipped" };
  }

  let vector: number[];
  try {
    vector = await embedText(text, { inputType: "document" });
  } catch (err) {
    if (err instanceof VoyageConfigError) {
      return { embedded: false, dims: VOYAGE_DIMS, note: err.message };
    }
    throw err;
  }

  const { error: upErr } = await supabase
    .from("profiles")
    .update({ embedding: toVectorLiteral(vector) })
    .eq("id", profileId);
  if (upErr) {
    return { embedded: false, dims: VOYAGE_DIMS, note: `embedding upsert failed: ${upErr.message}` };
  }

  return { embedded: true, dims: vector.length };
}
