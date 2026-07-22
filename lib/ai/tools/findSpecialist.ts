/**
 * `find_specialist` (T6) -- an AI tool over the internal matching engine (T3,
 * group->specialist surface). Its `execute` hits `matchSpecialistsForGroup`
 * (task 009) under the caller's RLS and returns ranked candidates as a
 * structured block the room UI renders. This is a read, so it runs
 * automatically; actually *inviting* a candidate is a separate, human-approved
 * step (mirrors team-accept), so the AI proposes and a member confirms.
 */
import { tool } from "ai";
import { z } from "zod";
import { matchSpecialistsForGroup } from "@/lib/matching";
import type { ToolContext } from "./context";

/** Build the room-bound `find_specialist` tool. */
export function findSpecialistTool(ctx: ToolContext) {
  return tool({
    description:
      "Find specialists to widen the team for this room. Returns ranked candidate " +
      "profiles (with fit / proximity scores) as a UI block. Use when the room " +
      "needs a role it lacks. Inviting a candidate is a separate step a human approves.",
    inputSchema: z.object({
      role: z
        .string()
        .optional()
        .describe("Optional role to constrain the search, e.g. 'biostatistician'."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .describe("Maximum candidates to return (default 8)."),
    }),
    execute: async ({ role, limit }) => {
      const matches = await matchSpecialistsForGroup(ctx.roomId, {
        role: role ?? null,
        limit: limit ?? 8,
      });
      return {
        kind: "specialist_candidates" as const,
        role: role ?? null,
        count: matches.length,
        candidates: matches.map((m) => ({
          profileId: m.profileId,
          userId: m.userId,
          score: m.score,
          fit: m.fit,
          proximity: m.proximity,
          rerankScore: m.rerankScore,
        })),
      };
    },
  });
}
