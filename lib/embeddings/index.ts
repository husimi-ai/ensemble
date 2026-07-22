/**
 * Embeddings module barrel -- the public surface for Voyage-3.5 embedding.
 * Import from `@/lib/embeddings`; the vendor client stays behind this boundary
 * so a future embedder swap (F7 fallback: OpenAI text-embedding-3-large) touches
 * only `voyage.ts`.
 */
export {
  VOYAGE_MODEL,
  VOYAGE_DIMS,
  VoyageConfigError,
  isVoyageConfigured,
  embedText,
  embedTexts,
  toVectorLiteral,
  type VoyageInputType,
  type EmbedOptions,
  type EmbedResult,
} from "./voyage";
