/**
 * POST /api/onboarding/resolve -- the "Is this you?" disambiguation step (T1).
 * Body: { name, institution?, orcid? } -> candidate author profiles the
 * onboarding UI (008) renders for the user to confirm. Server-only; requires an
 * authenticated session. No secrets: OpenAlex/ORCID are keyless public APIs.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { resolveCandidates } from "@/lib/profile/resolve";

export const runtime = "nodejs";

const BodySchema = z.object({
  name: z.string().min(1),
  institution: z.string().nullish(),
  orcid: z.string().nullish(),
});

export async function POST(req: Request): Promise<Response> {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  }

  const result = await resolveCandidates({
    name: parsed.data.name,
    institution: parsed.data.institution ?? null,
    orcid: parsed.data.orcid ?? null,
  });
  return NextResponse.json(result);
}
