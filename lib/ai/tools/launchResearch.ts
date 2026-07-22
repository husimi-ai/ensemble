/**
 * `launch_research` (T5) -- enqueue a deep-research job and return its id
 * synchronously. The heavy multi-minute loop (parallel budget-capped web-search
 * subagents on the Claude Agent SDK) runs OUTSIDE this serverless route in
 * `services/research/worker.ts`; the worker posts a cited synthesis back to the
 * room when done (F6: no long research in a route handler).
 *
 * A `research_jobs` row is created under the caller's RLS (member + own
 * `requested_by`), pinned to the same id the pg-boss job carries, so the row,
 * the queue job, and the resumable progress key all align. Not human-approved:
 * launching research has no real-world side-effect (it only reads the web).
 */
import { randomUUID } from "node:crypto";
import { tool } from "ai";
import { z } from "zod";
import { enqueueResearch } from "@/lib/jobs";
import { createClient } from "@/lib/supabase/server";
import type { ToolContext } from "./context";

/** Build the room/member-bound `launch_research` tool. */
export function launchResearchTool(ctx: ToolContext) {
  return tool({
    description:
      "Launch a deep-research job on a question. Runs in a background worker and " +
      "posts a cited synthesis back to the room when done. Use for questions that " +
      "need external literature or evidence, not for quick answers.",
    inputSchema: z.object({
      question: z.string().describe("The precise research question to investigate."),
    }),
    execute: async ({ question }) => {
      const jobId = randomUUID();
      const supabase = createClient();
      const { error } = await supabase.from("research_jobs").insert({
        id: jobId,
        room_id: ctx.roomId,
        requested_by: ctx.userId,
        prompt: question,
        status: "queued",
        pgboss_job_id: jobId,
      });
      if (error) return { ok: false as const, error: error.message };

      try {
        await enqueueResearch({
          jobId,
          roomId: ctx.roomId,
          question,
          requestedBy: ctx.userId,
        });
      } catch (err) {
        return {
          ok: false as const,
          jobId,
          error: err instanceof Error ? err.message : "enqueue failed",
        };
      }

      return {
        ok: true as const,
        jobId,
        status: "queued" as const,
        note: "Deep research started. A cited synthesis will be posted to the room when it finishes.",
      };
    },
  });
}
