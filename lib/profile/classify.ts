/**
 * Role classification (T2): assign each profile a role -- problem_identifier /
 * builder / researcher -- via an LLM pass over the stitched profile, emitting a
 * role + confidence [0,1] + a short rationale, with secondary-role signals kept
 * for multi-hat people. Publications/topics -> researcher; engineering/product ->
 * builder; clinical/domain + problem-framing -> problem_identifier (spec T2).
 *
 * Persists `role` + `role_confidence` (the columns the matcher post-filters on,
 * 0002) and stashes the rationale + secondary signals into `provenance`
 * (`roleClassification` key) so the accept screen (C10) can show and let the user
 * contest it. Uses the Anthropic SDK when `ANTHROPIC_API_KEY` is set; otherwise a
 * deterministic heuristic so the pipeline never blocks (mirrors the stitch step).
 * Server-only; secrets never reach the client.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

/** Assigned role -- mirrors the `profile_role` enum in migration 0002. */
export const RoleSchema = z.enum(["problem_identifier", "builder", "researcher"]);
export type Role = z.infer<typeof RoleSchema>;

/** A retained secondary-role signal (multi-hat people carry more than one). */
export const RoleSignalSchema = z.object({
  role: RoleSchema,
  confidence: z.number(),
});
export type RoleSignal = z.infer<typeof RoleSignalSchema>;

/** The LLM's role-classification output (role + confidence + rationale). */
export const RoleClassificationSchema = z.object({
  role: RoleSchema,
  confidence: z.number(),
  rationale: z.string(),
  secondarySignals: z.array(RoleSignalSchema),
});
export type RoleClassification = z.infer<typeof RoleClassificationSchema>;

const CLASSIFY_MODEL = "claude-haiku-4-5";

const SYSTEM = [
  "You classify a person's PRIMARY role on a medical research/build team into",
  "exactly one of: problem_identifier, builder, researcher.",
  "Signals: many publications / research topics / an academic record => researcher;",
  "software / engineering / product / data-pipeline history => builder;",
  "clinical or domain practice plus framing unmet needs => problem_identifier.",
  "Output the role, a confidence in [0,1], a ONE-sentence rationale grounded in",
  "the profile, and secondarySignals for any other roles the person also fits",
  "(each with its own [0,1] confidence). Roles are contestable, so be calibrated:",
  "reserve high confidence for clear-cut cases.",
].join(" ");

/** The `profiles` columns that feed classification. */
interface ClassifiableProfile {
  headline: string | null;
  bio: string | null;
  research_topics: string[] | null;
  skills: string[] | null;
  publications: unknown[] | null;
  data_resources: string[] | null;
  provenance: Record<string, unknown> | null;
}

const PROFILE_SELECT =
  "headline,bio,research_topics,skills,publications,data_resources,provenance";

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** Compact payload for the LLM (bounded prompt tokens). */
function buildPayload(p: ClassifiableProfile): string {
  return JSON.stringify({
    headline: p.headline,
    bio: p.bio,
    researchTopics: (p.research_topics ?? []).slice(0, 30),
    skills: (p.skills ?? []).slice(0, 40),
    publicationCount: (p.publications ?? []).length,
    dataResources: (p.data_resources ?? []).slice(0, 20),
  });
}

const BUILDER_HINTS = [
  "engineer", "engineering", "developer", "software", "programming", "python",
  "typescript", "javascript", "react", "backend", "frontend", "devops", "ml",
  "machine learning", "data pipeline", "product", "founder", "cto",
];
const CLINICAL_HINTS = [
  "clinician", "clinical", "physician", "doctor", "nurse", "surgeon", "md",
  "patient", "hospital", "practitioner", "care", "diagnosis", "therapy",
];

function anyHint(haystack: string, hints: string[]): boolean {
  return hints.some((h) => haystack.includes(h));
}

/**
 * Heuristic classification when the LLM is unavailable (graceful degradation).
 * Publications dominate -> researcher; builder terms -> builder; clinical/domain
 * terms -> problem_identifier. Confidence stays modest (contestable by design).
 */
export function deterministicClassify(p: ClassifiableProfile): RoleClassification {
  const text = [
    p.headline ?? "",
    p.bio ?? "",
    ...(p.research_topics ?? []),
    ...(p.skills ?? []),
    ...(p.data_resources ?? []),
  ]
    .join(" ")
    .toLowerCase();
  const pubs = (p.publications ?? []).length;
  const builder = anyHint(text, BUILDER_HINTS);
  const clinical = anyHint(text, CLINICAL_HINTS);

  const secondary: RoleSignal[] = [];
  let role: Role;
  let confidence: number;
  let rationale: string;

  if (pubs >= 3 && !clinical) {
    role = "researcher";
    confidence = 0.65;
    rationale = `Authored ${pubs} publications with research topics, indicating a researcher.`;
    if (builder) secondary.push({ role: "builder", confidence: 0.4 });
  } else if (builder && pubs < 3) {
    role = "builder";
    confidence = 0.6;
    rationale = "Engineering / product signals in skills and headline indicate a builder.";
    if (pubs > 0) secondary.push({ role: "researcher", confidence: 0.35 });
  } else if (clinical) {
    role = "problem_identifier";
    confidence = 0.6;
    rationale = "Clinical / domain practice suggests a problem-identifier framing unmet needs.";
    if (pubs >= 3) secondary.push({ role: "researcher", confidence: 0.4 });
  } else {
    role = "problem_identifier";
    confidence = 0.35;
    rationale = "Sparse signals; defaulted to problem-identifier pending user confirmation.";
  }

  return { role, confidence, rationale, secondarySignals: secondary };
}

async function llmClassify(p: ClassifiableProfile): Promise<RoleClassification> {
  const client = new Anthropic();
  const message = await client.messages.parse({
    model: CLASSIFY_MODEL,
    max_tokens: 1024,
    system: SYSTEM,
    messages: [
      { role: "user", content: `Classify this profile.\n\n${buildPayload(p)}` },
    ],
    output_config: { format: zodOutputFormat(RoleClassificationSchema) },
  });
  return message.parsed_output ?? deterministicClassify(p);
}

export interface ClassifyProfileResult extends RoleClassification {
  persisted: boolean;
  /** Present when persistence was skipped or failed. */
  note?: string;
}

/**
 * Classify a profile's role and persist it. Reads the profile, runs the LLM (or
 * the deterministic fallback), writes `role` + `role_confidence`, and merges the
 * rationale + secondary signals into `provenance.roleClassification`. Returns the
 * full classification (role + confidence + rationale + secondary signals).
 */
export async function classifyProfile(
  supabase: SupabaseClient,
  profileId: string,
): Promise<ClassifyProfileResult> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", profileId)
    .single();
  if (error || !data) {
    const fallback = deterministicClassify({
      headline: null, bio: null, research_topics: null, skills: null,
      publications: null, data_resources: null, provenance: null,
    });
    return { ...fallback, persisted: false, note: "profile not found" };
  }

  const profile = data as unknown as ClassifiableProfile;
  const result = process.env.ANTHROPIC_API_KEY
    ? await llmClassify(profile)
    : deterministicClassify(profile);
  result.confidence = clamp01(result.confidence);
  result.secondarySignals = result.secondarySignals.map((s) => ({
    role: s.role,
    confidence: clamp01(s.confidence),
  }));

  // Preserve existing per-field provenance; add role classification detail.
  const provenance = {
    ...(profile.provenance ?? {}),
    roleClassification: {
      role: result.role,
      confidence: result.confidence,
      rationale: result.rationale,
      secondarySignals: result.secondarySignals,
    },
  };

  const { error: upErr } = await supabase
    .from("profiles")
    .update({
      role: result.role,
      role_confidence: result.confidence,
      provenance,
    })
    .eq("id", profileId);
  if (upErr) {
    return { ...result, persisted: false, note: `role persist failed: ${upErr.message}` };
  }
  return { ...result, persisted: true };
}
