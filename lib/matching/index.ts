/**
 * Matching engine -- server API (T3). One thin layer over the three Postgres
 * RPCs in `0008_matching_rpc.sql`: run the surface's hybrid + bounded-proximity
 * RPC (stages 1-2, all in SQL), then Cohere-rerank the shortlist (stage 3, live
 * on load) and return the ranked result. Reused by the feed (this dir's route),
 * the specialist finder (014), and provider matching (015).
 *
 * Import via `@/lib/matching`. Server-only (uses the request-scoped RLS client +
 * server secrets). Rerank is skippable: when it's off or unconfigured the SQL
 * ordering stands. No LLM in the scoring hot path (spec F7).
 */
import { createClient } from "@/lib/supabase/server";
import type { Problem, ProblemOrigin, ProblemStatus } from "@/lib/types";
import { rerankDocuments, DEFAULT_TOP_N } from "./rerank";

export { isRerankConfigured, RERANK_MODEL } from "./rerank";
export * from "./proximity";

// --- RPC row shapes (the doc string is the candidate text for the reranker) ----
interface ProblemRpcRow {
  problem_id: string;
  fit: number;
  proximity: number;
  score: number;
  doc: string | null;
}
interface SpecialistRpcRow {
  profile_id: string;
  user_id: string;
  fit: number;
  proximity: number;
  score: number;
  doc: string | null;
}

// --- Public result shapes ------------------------------------------------------
/** A ranked feed problem with its score breakdown + optional rerank score. */
export interface ProblemMatch {
  problem: Problem;
  fit: number;
  proximity: number;
  score: number;
  rerankScore: number | null;
}
/** A ranked person (specialist or data provider) with its score breakdown. */
export interface SpecialistMatch {
  profileId: string;
  userId: string;
  fit: number;
  proximity: number;
  score: number;
  rerankScore: number | null;
}
export type ProviderMatch = SpecialistMatch;

/** Common options: cap the result, widen the SQL candidate pool, toggle rerank. */
export interface MatchOptions {
  limit?: number;
  pool?: number;
  rerank?: boolean;
  rerankTopN?: number;
}

const PROBLEM_COLUMNS =
  "id,title,description,subfield,tags,required_roles,required_skills,origin,submitted_by,status,created_at,updated_at";

interface ProblemDbRow {
  id: string;
  title: string;
  description: string | null;
  subfield: string | null;
  tags: string[] | null;
  required_roles: string[] | null;
  required_skills: string[] | null;
  origin: ProblemOrigin;
  submitted_by: string | null;
  status: ProblemStatus;
  created_at: string;
  updated_at: string;
}

function mapProblem(r: ProblemDbRow): Problem {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? "",
    subfield: r.subfield,
    tags: r.tags ?? [],
    requiredRoles: r.required_roles ?? [],
    requiredSkills: r.required_skills ?? [],
    origin: r.origin,
    submittedBy: r.submitted_by,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Rerank `items` in place of the SQL order using their aligned `docs`. Returns
 * `items` unchanged when the reranker is skipped (unconfigured / empty). Only the
 * top `topN` are reranked (the shortlist); the tail keeps the SQL ordering.
 */
async function applyRerank<T extends { rerankScore: number | null }>(
  query: string,
  items: T[],
  docs: string[],
  topN: number,
): Promise<T[]> {
  const depth = Math.min(topN, items.length);
  const hits = await rerankDocuments(query, docs.slice(0, depth), depth);
  if (!hits) return items;
  const head = items.slice(0, depth);
  const tail = items.slice(depth);
  const reordered = hits
    .filter((h) => h.index < head.length)
    .map((h) => ({ ...head[h.index], rerankScore: h.relevanceScore }));
  return [...reordered, ...tail];
}

/** Compose the FTS/rerank query text from a user's own (RLS-readable) profile. */
async function userQueryText(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("headline,research_topics,skills")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return "";
  const topics = (data.research_topics as string[] | null) ?? [];
  const skills = (data.skills as string[] | null) ?? [];
  return [data.headline ?? "", ...topics, ...skills].filter(Boolean).join(" ");
}

/**
 * Surface a -- rank published problems for a user (the feed). The RPC queries by
 * the user's own profile embedding + text and applies the bounded proximity boost
 * relative to each problem's submitter; then the shortlist is reranked live.
 */
export async function matchProblemsForUser(
  userId: string,
  opts: MatchOptions & { subfield?: string | null } = {},
): Promise<ProblemMatch[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("match_problems_for_user", {
    p_user_id: userId,
    p_limit: opts.limit ?? 50,
    p_pool: opts.pool ?? 200,
    p_subfield: opts.subfield ?? null,
  });
  if (error || !data) return [];
  const rows = data as ProblemRpcRow[];

  const ids = rows.map((r) => r.problem_id);
  const byId = new Map<string, Problem>();
  if (ids.length) {
    const { data: probs } = await supabase
      .from("problems")
      .select(PROBLEM_COLUMNS)
      .in("id", ids);
    for (const p of (probs as ProblemDbRow[] | null) ?? []) {
      byId.set(p.id, mapProblem(p));
    }
  }

  const items: ProblemMatch[] = [];
  const docs: string[] = [];
  for (const r of rows) {
    const problem = byId.get(r.problem_id);
    if (!problem) continue; // hidden by RLS -> drop from the feed
    items.push({
      problem,
      fit: r.fit,
      proximity: r.proximity,
      score: r.score,
      rerankScore: null,
    });
    docs.push(r.doc ?? `${problem.title} ${problem.description}`);
  }

  if (opts.rerank === false) return items;
  const query = await userQueryText(supabase, userId);
  return applyRerank(query, items, docs, opts.rerankTopN ?? DEFAULT_TOP_N);
}

/** Map specialist/provider RPC rows to the public shape + aligned rerank docs. */
function toSpecialistItems(rows: SpecialistRpcRow[]): {
  items: SpecialistMatch[];
  docs: string[];
} {
  const items: SpecialistMatch[] = [];
  const docs: string[] = [];
  for (const r of rows) {
    items.push({
      profileId: r.profile_id,
      userId: r.user_id,
      fit: r.fit,
      proximity: r.proximity,
      score: r.score,
      rerankScore: null,
    });
    docs.push(r.doc ?? "");
  }
  return { items, docs };
}

/**
 * Surface b -- rank specialists to widen a group's thin/lopsided pool (T4 widen
 * path). Optionally constrain to a role; the RPC queries by the group's problem
 * and boosts by proximity to the group's members.
 */
export async function matchSpecialistsForGroup(
  groupId: string,
  opts: MatchOptions & { role?: string | null } = {},
): Promise<SpecialistMatch[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("match_specialists_for_group", {
    p_group_id: groupId,
    p_role: opts.role ?? null,
    p_limit: opts.limit ?? 50,
    p_pool: opts.pool ?? 200,
  });
  if (error || !data) return [];
  const { items, docs } = toSpecialistItems(data as SpecialistRpcRow[]);
  if (opts.rerank === false) return items;

  const { data: prob } = await supabase
    .from("groups")
    .select("problems(title,description)")
    .eq("id", groupId)
    .maybeSingle();
  const p = (prob?.problems as { title: string; description: string | null } | null) ?? null;
  const query = p ? `${p.title} ${p.description ?? ""}` : "";
  return applyRerank(query, items, docs, opts.rerankTopN ?? DEFAULT_TOP_N);
}

/**
 * Surface c -- rank likely data providers for a published data-request listing
 * (T3 surface c / operator endgame). The RPC filters to resource holders, queries
 * by the listing, and boosts by proximity to the requesting group.
 */
export async function matchProvidersForRequest(
  listingId: string,
  opts: MatchOptions = {},
): Promise<ProviderMatch[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("match_providers_for_request", {
    p_listing_id: listingId,
    p_limit: opts.limit ?? 50,
    p_pool: opts.pool ?? 200,
  });
  if (error || !data) return [];
  const { items, docs } = toSpecialistItems(data as SpecialistRpcRow[]);
  if (opts.rerank === false) return items;

  const { data: listing } = await supabase
    .from("data_request_listings")
    .select("title,description")
    .eq("id", listingId)
    .maybeSingle();
  const query = listing
    ? `${listing.title} ${(listing.description as string | null) ?? ""}`
    : "";
  return applyRerank(query, items, docs, opts.rerankTopN ?? DEFAULT_TOP_N);
}
