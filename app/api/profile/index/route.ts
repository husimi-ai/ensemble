/**
 * POST /api/profile/index -- turn a stitched profile into matchable signals (007).
 *
 * Body: { profileId? } -- defaults to the authenticated user's own profile.
 * Flow: embed the profile with Voyage-3.5 into `profiles.embedding` (halfvec(1024))
 * and run LLM role-classification (problem_identifier / builder / researcher +
 * confidence + rationale) into `profiles.role` / `role_confidence`. Both feed the
 * matching engine (009) and the team-accept screen (C10).
 *
 * Server-only; requires a session and runs under RLS (self rows). Recompute is the
 * caller's call (invoke after a profile edit). Degrades gracefully: a missing
 * Voyage key leaves the embedding null with a note; the LLM falls back to a
 * deterministic role heuristic. Secrets never reach the client.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { embedProfile } from "@/lib/profile/embed";
import { classifyProfile } from "@/lib/profile/classify";

export const runtime = "nodejs";

const BodySchema = z.object({
  profileId: z.string().uuid().optional(),
});

export async function POST(req: Request): Promise<Response> {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let raw: unknown = {};
  if (req.headers.get("content-length") && req.headers.get("content-length") !== "0") {
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
    }
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  }

  const supabase = createClient();

  // Resolve the target profile: an explicit id, else the caller's own profile.
  let profileId = parsed.data.profileId ?? null;
  if (!profileId) {
    const { data: own } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();
    profileId = (own?.id as string | undefined) ?? null;
  }
  if (!profileId) {
    return NextResponse.json({ error: "no profile to index" }, { status: 404 });
  }

  // Verify the profile is visible to this caller (RLS: self rows).
  const { data: exists, error: existsErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", profileId)
    .single();
  if (existsErr || !exists) {
    return NextResponse.json({ error: "profile not found" }, { status: 404 });
  }

  // Embed then classify (disjoint columns; sequential for a deterministic write).
  const embedding = await embedProfile(supabase, profileId);
  const classification = await classifyProfile(supabase, profileId);

  return NextResponse.json({
    profileId,
    embedding,
    classification,
  });
}
