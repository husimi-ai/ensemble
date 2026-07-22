/**
 * Deep-research worker (T5/F6) -- the Node background process that consumes
 * pg-boss `research` jobs, runs the Claude Agent SDK loop (parallel web-search
 * subagents, budget-capped), streams progress to `research_jobs`, and posts the
 * cited synthesis back to the room as an `ai` message (`kind: "research_result"`).
 * This runs OUTSIDE any serverless route (multi-minute runs blow the duration
 * cap). Start it as its own process:  `tsx services/research/worker.ts`.
 *
 * Server-only: service-role DB writes (`research_jobs` update is operator-only;
 * the worker bypasses RLS) + the Agent SDK runtime (reads `ANTHROPIC_API_KEY`).
 */
import { fileURLToPath } from "node:url";
import { postAiArtifact, getBoss, stopBoss, RESEARCH_QUEUE, type ResearchJobData } from "@/lib/jobs";
import { adminClient } from "@/lib/teams/admin";
import { runResearch } from "./agent";

/** Minimum ms between progress writes -- one DB round-trip per turn would spam. */
const PROGRESS_THROTTLE_MS = 2_000;

type JobPatch = Record<string, unknown>;

/** Patch a `research_jobs` row (service-role; RLS update is operator-only). */
async function updateJob(jobId: string, patch: JobPatch): Promise<void> {
  const { error } = await adminClient().from("research_jobs").update(patch).eq("id", jobId);
  if (error) console.error(`[research-worker] job ${jobId} update failed`, error);
}

/** Run one research job end-to-end: research -> post synthesis -> record state. */
async function runJob(data: ResearchJobData): Promise<void> {
  const { jobId, roomId, question } = data;
  const startedAt = new Date().toISOString();
  await updateJob(jobId, {
    status: "running",
    progress: { phase: "running", turns: 0, startedAt },
  });

  let lastProgressAt = 0;
  const onTurn = async (turns: number) => {
    const now = Date.now();
    if (now - lastProgressAt < PROGRESS_THROTTLE_MS) return;
    lastProgressAt = now;
    await updateJob(jobId, {
      progress: { phase: "researching", turns, updatedAt: new Date().toISOString() },
    });
  };

  const { synthesis, costUsd, turns, failure } = await runResearch(question, onTurn);

  const cited = synthesis?.trim();
  if (cited && cited.length > 0) {
    const posted = await postAiArtifact({ roomId, kind: "research_result", content: cited });
    await updateJob(jobId, {
      status: "done",
      cost_usd: costUsd,
      result: { synthesis: cited, turns },
      result_message_id: posted?.id ?? null,
      progress: { phase: "done", turns, finishedAt: new Date().toISOString() },
    });
  } else {
    await updateJob(jobId, {
      status: "failed",
      cost_usd: costUsd,
      progress: {
        phase: "failed",
        turns,
        error: failure ?? "no synthesis produced",
        finishedAt: new Date().toISOString(),
      },
    });
  }
}

/**
 * Boot the worker: subscribe to the research queue (pg-boss hands the handler a
 * batch; we run jobs sequentially so one heavy Agent-SDK run doesn't starve the
 * others) and wire graceful shutdown. Resolves once subscribed; the process then
 * stays alive on the pg-boss poller.
 */
export async function runWorker(): Promise<void> {
  const boss = await getBoss("consumer");
  await boss.work<ResearchJobData>(RESEARCH_QUEUE, async (jobs) => {
    for (const job of jobs) {
      try {
        await runJob(job.data);
      } catch (err) {
        console.error(`[research-worker] job ${job.data.jobId} crashed`, err);
      }
    }
  });
  console.log(`[research-worker] consuming '${RESEARCH_QUEUE}'`);

  const shutdown = async (signal: string) => {
    console.log(`[research-worker] ${signal} -> shutting down`);
    await stopBoss();
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

// Run only when invoked directly (not when imported for typecheck / reuse).
const invokedPath = process.argv[1];
const isMain = invokedPath ? invokedPath === fileURLToPath(import.meta.url) : false;
if (isMain) {
  runWorker().catch((err) => {
    console.error("[research-worker] fatal", err);
    process.exit(1);
  });
}
