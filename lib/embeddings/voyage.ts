/**
 * Voyage-3.5 embedding client (T3, F7) -- the one embedding vendor for the whole
 * matching corpus. Profiles, problems, and data-request listings all embed to a
 * **1024-dim** vector stored as `halfvec(1024)` in the same Supabase Postgres.
 *
 * Server-only: reads `VOYAGE_API_KEY` (never expose to the client). Batch-friendly
 * (the Voyage list endpoint caps a request at 128 inputs); `embedTexts` chunks and
 * preserves input order. When the key is absent the client is unconfigured and
 * `embedTexts` throws {@link VoyageConfigError} so callers can degrade gracefully
 * (F7: a missing embedding is a non-fatal, recomputable state).
 */
import { VoyageAIClient } from "voyageai";

/** Primary embedding model + fixed output geometry (must match `halfvec(1024)`). */
export const VOYAGE_MODEL = "voyage-3.5";
export const VOYAGE_DIMS = 1024;
/** Voyage caps a single embed request at 128 inputs. */
const MAX_BATCH = 128;

/** Voyage input-type hint: corpus rows are `document`, search text is `query`. */
export type VoyageInputType = "query" | "document";

export interface EmbedOptions {
  /** Defaults to `document` (we embed profiles/problems as corpus rows). */
  inputType?: VoyageInputType;
}

export interface EmbedResult {
  /** One 1024-dim vector per input, in the same order as `inputs`. */
  embeddings: number[][];
  model: string;
  dims: number;
}

/** Thrown when `VOYAGE_API_KEY` is unset, so callers can skip (not crash). */
export class VoyageConfigError extends Error {
  constructor() {
    super("VOYAGE_API_KEY is not set; embedding skipped");
    this.name = "VoyageConfigError";
  }
}

let cached: VoyageAIClient | null = null;

/** Whether a Voyage key is configured (so callers can branch before embedding). */
export function isVoyageConfigured(): boolean {
  return Boolean(process.env.VOYAGE_API_KEY);
}

function getClient(): VoyageAIClient {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new VoyageConfigError();
  if (!cached) cached = new VoyageAIClient({ apiKey });
  return cached;
}

function chunk<T>(xs: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

/**
 * Embed a batch of texts to 1024-dim Voyage-3.5 vectors, preserving order.
 * Throws {@link VoyageConfigError} if unconfigured, or `Error` on a malformed
 * response / wrong dimensionality (a hard invariant for the `halfvec(1024)` column).
 */
export async function embedTexts(
  inputs: string[],
  opts: EmbedOptions = {},
): Promise<EmbedResult> {
  const client = getClient();
  const inputType = opts.inputType ?? "document";
  const embeddings: number[][] = new Array(inputs.length);
  let offset = 0;

  for (const batch of chunk(inputs, MAX_BATCH)) {
    const res = await client.embed({
      input: batch,
      model: VOYAGE_MODEL,
      inputType,
      outputDimension: VOYAGE_DIMS,
      truncation: true,
    });
    const data = res.data;
    if (!data || data.length !== batch.length) {
      throw new Error(
        `Voyage returned ${data?.length ?? 0} embeddings for ${batch.length} inputs`,
      );
    }
    for (const item of data) {
      const vec = item.embedding;
      const idx = item.index;
      if (!vec || vec.length !== VOYAGE_DIMS || idx == null) {
        throw new Error(
          `Voyage embedding malformed (dims=${vec?.length ?? 0}, expected ${VOYAGE_DIMS})`,
        );
      }
      embeddings[offset + idx] = vec;
    }
    offset += batch.length;
  }

  return { embeddings, model: VOYAGE_MODEL, dims: VOYAGE_DIMS };
}

/** Embed a single text -> one 1024-dim vector (convenience over {@link embedTexts}). */
export async function embedText(
  input: string,
  opts: EmbedOptions = {},
): Promise<number[]> {
  const { embeddings } = await embedTexts([input], opts);
  return embeddings[0];
}

/** pgvector text literal (`[v1,v2,...]`) accepted by `vector`/`halfvec` columns. */
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
