/**
 * `request_compute` / `request_data` (T5/T6) -- sibling tools that post a
 * compute or data ask from the room to the operator queue (a `resource_requests`
 * row). Both are side-effectful, so both are gated by `needsApproval`: the AI
 * proposes the request and a human member confirms before it lands (human in the
 * loop). The row is created under the caller's RLS (member + own `requested_by`);
 * the operator console (task 015) fulfils it.
 */
import { tool } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ResourceKind } from "@/lib/types";
import type { ToolContext } from "./context";

/** Insert a `resource_requests` row for the room; returns the new id + status. */
async function createResourceRequest(
  ctx: ToolContext,
  kind: ResourceKind,
  description: string,
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("resource_requests")
    .insert({
      group_id: ctx.roomId,
      kind,
      description,
      requested_by: ctx.userId,
      status: "requested",
    })
    .select("id, status")
    .single();
  if (error || !data) {
    return { ok: false as const, error: error?.message ?? "insert failed" };
  }
  return { ok: true as const, requestId: data.id as string, status: data.status as string };
}

/** Build the room/member-bound `request_compute` tool (human-approved). */
export function requestComputeTool(ctx: ToolContext) {
  return tool({
    description:
      "Request compute resources (e.g. GPU hours) for the team's work. Creates a " +
      "resource request that a human approves before anything is provisioned.",
    inputSchema: z.object({
      justification: z.string().describe("Why the compute is needed and for what."),
      amount: z.string().describe("Rough size of the request, e.g. '2x A100, 20h'."),
    }),
    needsApproval: true,
    execute: async ({ justification, amount }) =>
      createResourceRequest(ctx, "compute", `${justification} (size: ${amount})`),
  });
}

/** Build the room/member-bound `request_data` tool (human-approved). */
export function requestDataTool(ctx: ToolContext) {
  return tool({
    description:
      "Request access to a dataset for the team's work. Creates a data request " +
      "that a human approves before any access is granted.",
    inputSchema: z.object({
      description: z.string().describe("The dataset needed and what it is for."),
    }),
    needsApproval: true,
    execute: async ({ description }) => createResourceRequest(ctx, "data", description),
  });
}
