/**
 * GET /api/feed -- the person->problem home feed (T3 surface a).
 *
 * Runs the matching engine for the signed-in user: the SQL RPC does the 3-stage
 * hybrid (WHERE filter -> vector+FTS RRF -> bounded proximity boost) off the
 * periodically-refreshed `feed_problems` materialized view, then Cohere reranks
 * the shortlist live on load. Returns ranked `Problem`s with their score
 * breakdown. Rerank is skippable via `?rerank=false` (cold/empty feeds).
 *
 * Query params: `limit` (1-100, default 50), `subfield` (optional filter),
 * `rerank` (`false` to skip stage 3). Server-only; requires a session (RLS).
 */
import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { matchProblemsForUser } from "@/lib/matching";

export const runtime = "nodejs";

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const n = raw == null ? NaN : Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export async function GET(req: Request): Promise<Response> {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limit = clampInt(url.searchParams.get("limit"), 50, 1, 100);
  const subfield = url.searchParams.get("subfield") || null;
  const rerank = url.searchParams.get("rerank") !== "false";

  const items = await matchProblemsForUser(user.id, { limit, subfield, rerank });
  return NextResponse.json({ items, count: items.length });
}
