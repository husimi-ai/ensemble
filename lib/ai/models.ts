/**
 * Anthropic model routing for the AI participant (T5). One model per thread --
 * prompt caches are model-scoped -- so a thread stays on a single tier:
 *   - Haiku 4.5  gates / classifies intent (cheap, optional ambient volunteer),
 *   - Sonnet 5   runs the in-room chat turn (near-Opus quality at Sonnet cost),
 *   - Opus 4.8   drafts research synthesis / work-guides / papers.
 * Server-only: reads ANTHROPIC_API_KEY. Never import from client code.
 */
import { createAnthropic } from "@ai-sdk/anthropic";

/** Cheap @-gate / intent classification. */
export const GATE_MODEL = "claude-haiku-4-5";
/** Main in-room chat turn (task 013's default). */
export const CHAT_MODEL = "claude-sonnet-5";
/** Heavy synthesis: research + work-guide + paper drafting (task 014+). */
export const DRAFT_MODEL = "claude-opus-4-8";

/** Configured provider (server-only key). Call `anthropic(id)` to get a model. */
export const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/** The three routed tiers, resolved to language models. */
export const gateModel = anthropic(GATE_MODEL);
export const chatModel = anthropic(CHAT_MODEL);
export const draftModel = anthropic(DRAFT_MODEL);
