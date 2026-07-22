/**
 * POST /api/teams/assemble -- trigger balanced-team assembly for a problem's pool
 * (task 011). Runs occasionally, not per request: an operator action or a
 * schedule calls it with `{ problemId }`. It calls the Python worker (010) and
 * persists the outcome -- proposed Group + pending Memberships on OK, or the
 * unmatched/widen path on INFEASIBLE (C16).
 *
 * Authorization (fail closed): the operator (RLS `is_operator()` / founder email)
 * OR a scheduler presenting the `ASSEMBLY_TRIGGER_SECRET` bearer token, so a cron
 * job with no user session can still fire it. Server-only; Node runtime (the
 * assembly write path uses the service-role client).
 */
import { NextResponse } from "next/server";
import { isOperator } from "@/lib/operator/guard";
import { assembleProblem } from "@/lib/teams";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** True when the request is an operator session or carries the scheduler token. */
async function authorized(req: Request): Promise<boolean> {
  const secret = process.env.ASSEMBLY_TRIGGER_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth === `Bearer ${secret}`) return true;
  }
  return isOperator();
}

export async function POST(req: Request): Promise<Response> {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { problemId?: string };
  const problemId = body.problemId?.trim();
  if (!problemId) {
    return NextResponse.json({ error: "problemId required" }, { status: 400 });
  }

  try {
    const summary = await assembleProblem(problemId);
    return NextResponse.json(summary);
  } catch (e) {
    const message = e instanceof Error ? e.message : "assembly failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
