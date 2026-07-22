/**
 * AI participant tool definitions (T5). THIN STUBS ONLY -- shape + Zod
 * `inputSchema`, in a deterministic key order so the tool JSON stays byte-stable
 * inside the cached prompt prefix (F6). No `execute` bodies here on purpose:
 * task 014 wires them to the real actions (enqueue a pg-boss deep-research job on
 * the Claude Agent SDK worker; hit the internal compute/data-request API behind
 * human-approval gates; draft a work-guide with Opus). Until then the model can
 * *propose* a call that a later task fulfils -- the chat turn itself is text.
 */
import { tool } from "ai";
import { z } from "zod";

/** Launch a deep-research job (background worker; posts a cited synthesis back). */
const launchResearch = tool({
  description:
    "Launch a deep-research job on a question. Runs in a background worker and " +
    "posts a cited synthesis back to the room when done. Use for questions that " +
    "need external literature or evidence, not for quick answers.",
  inputSchema: z.object({
    question: z.string().describe("The precise research question to investigate."),
  }),
});

/** Request compute resources for the team's work, pending human approval. */
const requestCompute = tool({
  description:
    "Request compute resources (e.g. GPU hours) for the team's work. Creates a " +
    "resource request that a human approves before anything is provisioned.",
  inputSchema: z.object({
    justification: z.string().describe("Why the compute is needed and for what."),
    amount: z.string().describe("Rough size of the request, e.g. '2x A100, 20h'."),
  }),
});

/** Request access to a dataset, pending human approval. */
const requestData = tool({
  description:
    "Request access to a dataset for the team's work. Creates a data request " +
    "that a human approves before any access is granted.",
  inputSchema: z.object({
    description: z.string().describe("The dataset needed and what it is for."),
  }),
});

/** Draft a structured work-guide for the room (heavy drafting lands in 014). */
const draftWorkGuide = tool({
  description:
    "Draft a structured work-guide (plan of concrete next steps) for the team " +
    "based on the room's discussion so far.",
  inputSchema: z.object({
    focus: z.string().describe("What the work-guide should cover."),
  }),
});

/**
 * The AI participant's tool set. Object key order is the wire order (F6: a stable
 * tool prefix keeps the prompt cache warm across summons). Task 014 attaches the
 * `execute` bodies; the shapes here are the contract those bodies fulfil.
 */
export const aiTools = {
  launch_research: launchResearch,
  request_compute: requestCompute,
  request_data: requestData,
  draft_work_guide: draftWorkGuide,
} as const;
