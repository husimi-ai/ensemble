/**
 * Cohere Rerank 3.5 -- stage 3 of the matching pipeline (T3). A cross-encoder
 * re-scores the top ~20-50 shortlist the SQL RPC produced; it matches/beats an
 * LLM reranker at a fraction of the latency/cost, and NO LLM ever touches the
 * scoring hot path (spec F7 / rules.md).
 *
 * Server-only: reads `COHERE_API_KEY`. Fully SKIPPABLE -- when the key is unset,
 * the query is empty, or there are no documents (cold/empty feed), or the call
 * errors, {@link rerankDocuments} returns `null` and the caller keeps the SQL
 * ordering. Secrets never reach the client.
 */
import { CohereClientV2 } from "cohere-ai";

/** Cohere Rerank 3.5 model id. */
export const RERANK_MODEL = "rerank-v3.5";
/** Default shortlist depth reranked when a caller doesn't specify one. */
export const DEFAULT_TOP_N = 30;

/** One reranked result: the index into the input `documents` + its score. */
export interface RerankHit {
  /** Index into the `documents` array passed in. */
  index: number;
  /** Relevance in [0, 1]; higher is more relevant. */
  relevanceScore: number;
}

/** Whether a Cohere key is configured (so callers can branch before reranking). */
export function isRerankConfigured(): boolean {
  return Boolean(process.env.COHERE_API_KEY);
}

let cached: CohereClientV2 | null = null;

function getClient(): CohereClientV2 {
  const token = process.env.COHERE_API_KEY;
  if (!token) throw new Error("COHERE_API_KEY is not set");
  if (!cached) cached = new CohereClientV2({ token });
  return cached;
}

/**
 * Rerank `documents` against `query`, returning hits ordered most- to
 * least-relevant. Returns `null` (caller keeps the input order) when reranking
 * is skipped: unconfigured key, empty query, no documents, or a call failure --
 * a missing reranker degrades the feed, it never breaks it.
 */
export async function rerankDocuments(
  query: string,
  documents: string[],
  topN: number = DEFAULT_TOP_N,
): Promise<RerankHit[] | null> {
  if (!isRerankConfigured() || !query.trim() || documents.length === 0) {
    return null;
  }
  try {
    const res = await getClient().rerank({
      model: RERANK_MODEL,
      query,
      documents,
      topN: Math.min(topN, documents.length),
    });
    return res.results.map((r) => ({
      index: r.index,
      relevanceScore: r.relevanceScore,
    }));
  } catch (err) {
    // Non-fatal: log and fall back to the SQL ordering.
    console.warn("[matching] Cohere rerank failed; using SQL order:", err);
    return null;
  }
}
