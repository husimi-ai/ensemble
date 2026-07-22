/**
 * pg-boss queue setup shared by the `launch_research` producer (the chat route's
 * tool) and the deep-research consumer (`services/research/worker.ts`) -- one
 * durable job runner on the same Postgres (T5, F6: "No long research in a
 * serverless route handler"; pg-boss picked for lowest friction on the existing
 * Postgres).
 *
 * The producer (route) enqueues and returns immediately; the consumer (worker)
 * runs the multi-minute Agent-SDK loop. Both share this queue name + connection.
 *
 * Server-only: needs a Postgres connection string (`DATABASE_URL`, falling back
 * to `SUPABASE_DB_URL`) -- the pooled/direct Supabase Postgres URI. Never import
 * from client code. pg-boss `start()` is required before `send`/`work`; a single
 * lazily-started instance per role is memoised per process.
 */
import { PgBoss } from "pg-boss";

/** The single deep-research job queue. Keep stable: it names rows in Postgres. */
export const RESEARCH_QUEUE = "research";

/** Payload of one enqueued research job -- the worker's whole input. */
export interface ResearchJobData {
  /** `research_jobs.id`; also the pg-boss job id (passed as `send`'s `id`). */
  jobId: string;
  /** Room (== `groups.id`) the cited synthesis is posted back to. */
  roomId: string;
  /** The precise research question to investigate. */
  question: string;
  /** The member who launched it (`research_jobs.requested_by`). */
  requestedBy: string;
}

/** Producer starts a lightweight instance (enqueue only); consumer supervises. */
export type BossRole = "producer" | "consumer";

/** Resolve the Postgres connection string pg-boss runs on. */
function connectionString(): string {
  const url = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
  if (!url) {
    throw new Error(
      "jobs/queue: DATABASE_URL (or SUPABASE_DB_URL) not set -- pg-boss needs a Postgres URI",
    );
  }
  return url;
}

const instances = new Map<BossRole, Promise<PgBoss>>();

/** Create the research queue if it doesn't exist yet (idempotent across roles). */
async function ensureQueue(boss: PgBoss): Promise<void> {
  const existing = await boss.getQueue(RESEARCH_QUEUE);
  if (existing) return;
  await boss.createQueue(RESEARCH_QUEUE, {
    // Research runs are long: allow up to an hour in `active` before the monitor
    // reclaims a job. maxBudgetUsd/maxTurns bound the run well under this.
    expireInSeconds: 3600,
    // Deep research is expensive -- don't blindly re-run on a transient failure.
    retryLimit: 1,
    // Keep finished jobs a day for inspection; research_jobs is the real record.
    deleteAfterSeconds: 86_400,
  });
}

/**
 * Lazily build + start a memoised pg-boss instance for the given role. The
 * `producer` disables the maintenance supervisor (a route only enqueues); the
 * `consumer` (worker) supervises so stalled/expired jobs are reclaimed. Both run
 * pg-boss's own schema migration (idempotent) and ensure the research queue.
 */
export function getBoss(role: BossRole = "producer"): Promise<PgBoss> {
  const cached = instances.get(role);
  if (cached) return cached;
  const started = (async () => {
    const boss = new PgBoss({
      connectionString: connectionString(),
      schedule: false,
      supervise: role === "consumer",
    });
    boss.on("error", (err) => console.error("[pg-boss]", err));
    await boss.start();
    await ensureQueue(boss);
    return boss;
  })();
  instances.set(role, started);
  return started;
}

/**
 * Enqueue a deep-research job and return its id. The pg-boss job id is pinned to
 * `data.jobId` (== `research_jobs.id`) so the row, the queue job, and the
 * resumable progress channel all share one key. Returns `null` if pg-boss
 * refused the insert.
 */
export async function enqueueResearch(data: ResearchJobData): Promise<string | null> {
  const boss = await getBoss("producer");
  return boss.send(RESEARCH_QUEUE, data, { id: data.jobId });
}

/** Stop the memoised instance(s) -- for worker shutdown / test teardown. */
export async function stopBoss(): Promise<void> {
  const pending = [...instances.values()];
  instances.clear();
  await Promise.all(
    pending.map(async (p) => {
      try {
        await (await p).stop({ graceful: true });
      } catch (err) {
        console.error("[pg-boss] stop failed", err);
      }
    }),
  );
}
