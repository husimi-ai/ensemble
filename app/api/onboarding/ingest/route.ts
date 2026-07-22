/**
 * POST /api/onboarding/ingest -- run the profile-investigation pipeline (T1) on
 * a confirmed anchor and persist the stitched, provenance-tagged profile.
 *
 * Body: { name, authorId?, orcid?, institution?, cv?: {text?|pdfBase64?}, links? }.
 * Flow: fetch the open scholarly sources (OpenAlex/ORCID/Europe PMC/Crossref) +
 * optional LLM CV parse -> record each as a `profile_sources` row (F5) -> LLM
 * stitch into one profile with per-field provenance + confidence -> resolve
 * institution geo -> write to `profiles`. Embedding + role are 007's job.
 *
 * Server-only; requires an authenticated session and runs under RLS (self rows).
 * Degrades gracefully: a source down yields a partial profile plus a note.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  fetchEuropePmcProfile,
  fetchOpenAlexProfile,
  fetchOrcidProfile,
  searchCrossrefByAuthor,
  searchOpenAlexInstitution,
  settle,
  type SourceNote,
} from "@/lib/scholarly";
import { parseCv } from "@/lib/profile/cv";
import { stitchProfile, type StitchSources } from "@/lib/profile/stitch";
import type { CvExtraction } from "@/lib/profile/schema";

export const runtime = "nodejs";

const BodySchema = z.object({
  name: z.string().min(1),
  authorId: z.string().nullish(),
  orcid: z.string().nullish(),
  institution: z.string().nullish(),
  cv: z.object({ text: z.string().optional(), pdfBase64: z.string().optional() }).nullish(),
  links: z.array(z.string()).nullish(),
});

interface SourceRow {
  profile_id: string;
  user_id: string;
  kind: string;
  source_url: string | null;
  external_id: string | null;
  raw: unknown;
  status: string;
  fetched_at: string | null;
}

export async function POST(req: Request): Promise<Response> {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  }
  const body = parsed.data;

  const supabase = createClient();
  const { data: profileRow, error: profileErr } = await supabase
    .from("profiles")
    .upsert({ user_id: user.id }, { onConflict: "user_id" })
    .select("id")
    .single();
  if (profileErr || !profileRow) {
    return NextResponse.json({ error: "could not load profile row" }, { status: 500 });
  }
  const profileId = profileRow.id as string;

  // --- 1. Fetch the open scholarly sources + optional CV parse -----------------
  const notes: SourceNote[] = [];
  const anchor = body.authorId ?? body.orcid ?? null;

  const openalex = anchor
    ? await settle("openalex", notes, () => fetchOpenAlexProfile(anchor))
    : null;
  const effectiveOrcid = body.orcid ?? openalex?.author.orcid ?? null;

  const orcid = effectiveOrcid
    ? await settle("orcid", notes, () => fetchOrcidProfile(effectiveOrcid))
    : null;
  const europepmc = await settle("europepmc", notes, () =>
    fetchEuropePmcProfile({ orcid: effectiveOrcid, name: body.name }),
  );
  const crossref = await settle("crossref", notes, () => searchCrossrefByAuthor(body.name));
  let cv: CvExtraction | null = null;
  if (body.cv && (body.cv.text || body.cv.pdfBase64)) {
    cv = await settle("cv", notes, () => parseCv(body.cv!));
  }

  const sources: StitchSources = { openalex, orcid, europepmc, crossref, cv };

  // --- 2. Persist a profile_sources row per source (provenance / re-ingest) ----
  const now = new Date().toISOString();
  const rows: SourceRow[] = [];
  if (openalex) {
    rows.push({
      profile_id: profileId, user_id: user.id, kind: "openalex",
      source_url: `https://openalex.org/${openalex.author.id}`,
      external_id: openalex.author.id, raw: openalex.author.raw, status: "fetched", fetched_at: now,
    });
  }
  if (orcid) {
    rows.push({
      profile_id: profileId, user_id: user.id, kind: "orcid",
      source_url: `https://orcid.org/${orcid.orcid}`, external_id: orcid.orcid,
      raw: orcid.authorHit.raw, status: "fetched", fetched_at: now,
    });
  }
  if (europepmc && europepmc.works.length) {
    rows.push({
      profile_id: profileId, user_id: user.id, kind: "europepmc",
      source_url: null, external_id: effectiveOrcid ?? body.name, raw: europepmc, status: "fetched", fetched_at: now,
    });
  }
  if (crossref && crossref.works.length) {
    rows.push({
      profile_id: profileId, user_id: user.id, kind: "crossref",
      source_url: null, external_id: body.name, raw: crossref, status: "fetched", fetched_at: now,
    });
  }
  if (cv) {
    rows.push({
      profile_id: profileId, user_id: user.id, kind: "cv",
      source_url: null, external_id: null, raw: cv, status: "fetched", fetched_at: now,
    });
  }
  for (const link of body.links ?? []) {
    rows.push({
      profile_id: profileId, user_id: user.id, kind: "url",
      source_url: link, external_id: null, raw: null, status: "pending", fetched_at: null,
    });
  }
  if (rows.length) {
    const { error } = await supabase.from("profile_sources").insert(rows);
    if (error) notes.push({ source: "cv", ok: false, detail: `profile_sources insert: ${error.message}` });
  }

  // --- 3. LLM stitch (or deterministic fallback) -> one tagged profile --------
  const stitched = await stitchProfile({ name: body.name, sources });
  const profile = stitched.profile;

  // --- 4. Resolve institution geo (proximity tiers, T3) -----------------------
  let institutionId: string | null = null;
  let city = profile.city;
  let country = profile.country;
  let latitude = profile.latitude;
  let longitude = profile.longitude;
  if (profile.institutionName) {
    const inst = await settle("openalex", notes, () =>
      searchOpenAlexInstitution(profile.institutionName!),
    );
    if (inst) {
      city = city ?? inst.city;
      country = country ?? inst.country;
      latitude = latitude ?? inst.latitude;
      longitude = longitude ?? inst.longitude;
      try {
        const { data } = await supabase
          .from("institutions")
          .upsert(
            { name: inst.name, ror_id: inst.ror, city: inst.city, country: inst.country, lat: inst.latitude, long: inst.longitude },
            { onConflict: "ror_id" },
          )
          .select("id")
          .single();
        institutionId = (data?.id as string | undefined) ?? null;
      } catch {
        institutionId = null; // RLS or no unique ROR -> keep geo only
      }
    }
  }

  // --- 5. Persist the stitched profile (embedding + role handled by 007) ------
  const { error: updateErr } = await supabase
    .from("profiles")
    .update({
      headline: profile.headline,
      bio: profile.bio,
      research_topics: profile.topics,
      skills: profile.skills,
      publications: profile.publications,
      data_resources: profile.resources,
      orcid: profile.orcid,
      openalex_id: profile.openalexId,
      institution_id: institutionId,
      city,
      country,
      lat: latitude,
      long: longitude,
      provenance: stitched.provenance,
      confidence: stitched.confidence,
    })
    .eq("id", profileId);
  if (updateErr) {
    return NextResponse.json({ error: `profile update failed: ${updateErr.message}`, notes }, { status: 500 });
  }

  return NextResponse.json({
    profileId,
    profile: { ...profile, city, country, latitude, longitude, institutionId },
    provenance: stitched.provenance,
    confidence: stitched.confidence,
    sources: rows.map((r) => r.kind),
    notes,
  });
}
