/**
 * The deep-research loop on the Claude Agent SDK (T5/F6). An Opus orchestrator
 * fans out parallel web-search subagents (the `web-researcher` agent, run
 * `background: true` so invocations don't block each other) using the built-in
 * `WebSearch` / `WebFetch` tools, bounded by `maxBudgetUsd` / `maxTurns`, then
 * synthesises a cited answer. Cheaper Haiku subagents do the reads; Opus does
 * the synthesis (one model per tier).
 *
 * Server-only: spawns the Agent SDK runtime, which reads `ANTHROPIC_API_KEY`
 * from the environment. Runs only inside the worker, never a route handler.
 */
import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import { DRAFT_MODEL, GATE_MODEL } from "@/lib/ai/models";

/** Dollar ceiling for one research run (Agent SDK stops past it). */
const MAX_BUDGET_USD = Number(process.env.RESEARCH_MAX_BUDGET_USD ?? "5");
/** Agentic-turn ceiling for one research run. */
const MAX_TURNS = Number(process.env.RESEARCH_MAX_TURNS ?? "40");

/** Web tools + the subagent-spawning Task tool the orchestrator may use. */
const RESEARCH_TOOLS = ["WebSearch", "WebFetch", "Task"] as const;

/** The parallel web-search subagent the orchestrator fans out to. */
const WEB_RESEARCHER_PROMPT = [
  "You are a focused web-research subagent. Given one sub-question, run web",
  "searches and fetch the most authoritative sources (prefer peer-reviewed and",
  "primary sources). Report concise findings, each with the source URL. Do not",
  "speculate beyond what the sources support; flag uncertainty explicitly.",
].join(" ");

/** Orchestrator instructions wrapped around the room's research question. */
function researchPrompt(question: string): string {
  return [
    "Research the following question thoroughly and produce a cited synthesis.",
    "Break it into sub-questions and dispatch the `web-researcher` subagent in",
    "parallel (one per sub-question) to gather evidence with source URLs.",
    "Cross-check claims across sources, resolve conflicts, and note confidence.",
    "Return a well-structured Markdown answer with inline citations (source URLs)",
    "and a short 'Sources' list. Be precise and grounded; do not fabricate.",
    "",
    `QUESTION: ${question}`,
  ].join("\n");
}

/** Options for the orchestrator `query()` call. */
function researchOptions(abortController: AbortController): Options {
  return {
    model: DRAFT_MODEL,
    maxTurns: MAX_TURNS,
    maxBudgetUsd: MAX_BUDGET_USD,
    // Headless worker: no interactive approver, so auto-allow the read-only web
    // tools. bypassPermissions requires the explicit safety opt-in.
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    // Don't inherit any local .claude filesystem settings in a server worker.
    settingSources: [],
    tools: [...RESEARCH_TOOLS],
    allowedTools: [...RESEARCH_TOOLS],
    agents: {
      "web-researcher": {
        description: "Runs focused web searches on one sub-question and reports cited findings.",
        prompt: WEB_RESEARCHER_PROMPT,
        tools: ["WebSearch", "WebFetch"],
        model: GATE_MODEL,
        background: true,
      },
    },
    abortController,
    // env REPLACES the subprocess environment; spread process.env to keep PATH,
    // HOME, and ANTHROPIC_API_KEY.
    env: { ...process.env },
  };
}

/** Outcome of one research run. `synthesis` is null on failure/budget stop. */
export interface ResearchOutcome {
  synthesis: string | null;
  costUsd: number;
  turns: number;
  failure: string | null;
}

/**
 * Run the research loop for `question`, calling `onTurn(turns)` as the
 * orchestrator advances (for progress). Resolves with the cited synthesis + the
 * run's cost. Never throws: an error / budget stop is returned as a failure.
 */
export async function runResearch(
  question: string,
  onTurn: (turns: number) => void | Promise<void>,
  abortController: AbortController = new AbortController(),
): Promise<ResearchOutcome> {
  let turns = 0;
  let costUsd = 0;
  let synthesis: string | null = null;
  let failure: string | null = null;

  try {
    const q = query({
      prompt: researchPrompt(question),
      options: researchOptions(abortController),
    });
    for await (const msg of q) {
      if (msg.type === "assistant") {
        turns += 1;
        await onTurn(turns);
      } else if (msg.type === "result") {
        costUsd = msg.total_cost_usd;
        if (msg.subtype === "success") synthesis = msg.result;
        else failure = `research stopped: ${msg.subtype}`;
      }
    }
  } catch (err) {
    failure = err instanceof Error ? err.message : "research failed";
  }

  return { synthesis, costUsd, turns, failure };
}
