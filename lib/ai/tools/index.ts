/**
 * The AI participant's tool set (T5/T6) -- real `execute` bodies, built per
 * summon and bound to a {@link ToolContext} (room + caller). Task 013 shipped the
 * thin shapes; this fills them in: `launch_research` enqueues a pg-boss job;
 * `find_specialist` hits the matching engine; `request_compute` / `request_data`
 * post to the operator queue behind human-approval gates; `draft_work_guide`
 * drafts an Opus work-guide.
 *
 * Object key order is the wire order (F6: a stable tool prefix keeps the prompt
 * cache warm across summons). `execute`/`needsApproval` bodies never enter the
 * cached tool JSON -- only each tool's description + `inputSchema` do -- so
 * binding runtime context via a factory is cache-safe.
 *
 * Server-only (the tools touch Postgres + server secrets). Import via
 * `@/lib/ai/tools`.
 */
import { findSpecialistTool } from "./findSpecialist";
import { launchResearchTool } from "./launchResearch";
import { requestComputeTool, requestDataTool } from "./requests";
import { draftWorkGuideTool } from "./workGuide";
import type { ToolContext } from "./context";

export type { ToolContext } from "./context";

/**
 * Build the AI participant's tools bound to a summon's room + caller. Pass the
 * result to `streamText({ tools })`. Deterministic key order (F6).
 */
export function createAiTools(ctx: ToolContext) {
  return {
    launch_research: launchResearchTool(ctx),
    find_specialist: findSpecialistTool(ctx),
    request_compute: requestComputeTool(ctx),
    request_data: requestDataTool(ctx),
    draft_work_guide: draftWorkGuideTool(ctx),
  } as const;
}
