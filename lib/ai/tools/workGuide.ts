/**
 * `draft_work_guide` (T5) -- draft a structured plan of concrete next steps for
 * the room and post it back as an `ai` message (`kind: "work_guide"`). Delegates
 * to `lib/ai/workguide.ts`, which runs a single bounded Opus synthesis inline
 * (not the background research worker). Not human-approved: it only produces an
 * AI artifact in the room, no real-world effect.
 */
import { tool } from "ai";
import { z } from "zod";
import { draftWorkGuide } from "@/lib/ai/workguide";
import type { ToolContext } from "./context";

/** Build the room-bound `draft_work_guide` tool. */
export function draftWorkGuideTool(ctx: ToolContext) {
  return tool({
    description:
      "Draft a structured work-guide (plan of concrete next steps) for the team " +
      "based on the room's discussion so far, and post it into the room.",
    inputSchema: z.object({
      focus: z.string().describe("What the work-guide should cover."),
    }),
    execute: async ({ focus }) => draftWorkGuide(ctx.roomId, focus),
  });
}
