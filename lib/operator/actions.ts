"use server";

/**
 * Operator console -- server actions (founder-only). Each action guards with
 * {@link requireOperator} before any write; RLS (task 001 `is_operator()`) is the
 * second gate at the row level. All return {@link ActionResult}; the client
 * refreshes the route on `ok`. `revalidatePath("/operator")` re-runs the loaders.
 *
 * Publishing a data request is the endgame path (C12): it creates a
 * `DataRequestListing` (with a best-effort Voyage query embedding) and runs the
 * 009 provider-matching surface so likely providers can be surfaced. Import via
 * `@/lib/operator/actions`.
 */
import { revalidatePath } from "next/cache";
import { matchProvidersForRequest } from "@/lib/matching";
import { embedText, isVoyageConfigured, toVectorLiteral } from "@/lib/embeddings";
import type { ActionResult } from "./data";
import { OperatorForbiddenError, requireOperator } from "./guard";

/** Map a thrown guard/DB error to an `{ error }` result (never leak a stack). */
function fail(e: unknown): ActionResult {
  if (e instanceof OperatorForbiddenError) return { error: e.message };
  return { error: e instanceof Error ? e.message : "Something went wrong." };
}

interface ProblemEdits {
  id: string;
  title: string;
  description: string;
  subfield: string;
  tags: string[];
  requiredRoles: string[];
  requiredSkills: string[];
}

/**
 * Edit a submitted problem and flip it draft/review -> published so it enters the
 * feed (T3 supply). Operator-writable via the `problems_update` RLS policy.
 */
export async function publishProblem(edits: ProblemEdits): Promise<ActionResult> {
  try {
    const { supabase } = await requireOperator();
    const title = edits.title.trim();
    if (!title) return { error: "A title is required to publish." };
    const { error } = await supabase
      .from("problems")
      .update({
        title,
        description: edits.description.trim() || null,
        subfield: edits.subfield.trim() || null,
        tags: edits.tags,
        required_roles: edits.requiredRoles,
        required_skills: edits.requiredSkills,
        status: "published",
      })
      .eq("id", edits.id);
    if (error) return { error: error.message };
    revalidatePath("/operator");
    return { ok: true, note: "Problem published to the feed." };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Mark a compute (or otherwise satisfied) resource request as fulfilled. Data
 * requests can instead be published via {@link publishDataRequest}.
 */
export async function fulfilRequest(requestId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireOperator();
    const { error } = await supabase
      .from("resource_requests")
      .update({ status: "fulfilled" })
      .eq("id", requestId);
    if (error) return { error: error.message };
    revalidatePath("/operator");
    return { ok: true, note: "Request marked fulfilled." };
  } catch (e) {
    return fail(e);
  }
}

interface PublishListingInput {
  requestId: string;
  title: string;
  description: string;
  tags: string[];
}

/**
 * Publish a data request (C12): create a `DataRequestListing`, mark the request
 * `published`, then run the 009 provider-matching surface. The listing embedding
 * is best-effort (skipped when Voyage is unconfigured -- the RPC then ranks on
 * text/tags alone). Returns the number of providers the match surfaced.
 */
export async function publishDataRequest(
  input: PublishListingInput,
): Promise<ActionResult> {
  try {
    const { supabase } = await requireOperator();
    const title = input.title.trim();
    if (!title) return { error: "A listing title is required." };
    const description = input.description.trim();

    let embedding: string | null = null;
    if (isVoyageConfigured()) {
      try {
        const vec = await embedText(`${title} ${description}`.trim(), {
          inputType: "document",
        });
        embedding = toVectorLiteral(vec);
      } catch {
        embedding = null; // fail-open: the RPC ranks on text/tags without it
      }
    }

    const { data: listing, error } = await supabase
      .from("data_request_listings")
      .insert({
        resource_request_id: input.requestId,
        title,
        description: description || null,
        tags: input.tags,
        embedding,
        status: "open",
      })
      .select("id")
      .single();
    if (error || !listing) {
      return { error: error?.message ?? "Failed to create the listing." };
    }

    const { error: upErr } = await supabase
      .from("resource_requests")
      .update({ status: "published" })
      .eq("id", input.requestId);
    if (upErr) return { error: upErr.message };

    let matchCount = 0;
    try {
      const matches = await matchProvidersForRequest(listing.id as string);
      matchCount = matches.length;
    } catch {
      // matching is best-effort here; the listing still stands for later runs.
    }

    revalidatePath("/operator");
    return {
      ok: true,
      note: `Listing published; matched ${matchCount} provider${
        matchCount === 1 ? "" : "s"
      }.`,
    };
  } catch (e) {
    return fail(e);
  }
}

interface VersionReviewInput {
  id: string;
  feedback: string;
  /** `feedback` returns it for another iteration; `taken_over` = founder takeover. */
  status: "feedback" | "taken_over";
}

/**
 * Review a submitted version: attach feedback and set the status to `feedback`
 * (bounce back for iteration) or `taken_over` (founder co-authors, C13/C14).
 */
export async function reviewVersion(input: VersionReviewInput): Promise<ActionResult> {
  try {
    const { supabase } = await requireOperator();
    const { error } = await supabase
      .from("versions")
      .update({
        feedback: input.feedback.trim() || null,
        status: input.status,
      })
      .eq("id", input.id);
    if (error) return { error: error.message };
    revalidatePath("/operator");
    return {
      ok: true,
      note: input.status === "taken_over" ? "Version taken over." : "Feedback sent.",
    };
  } catch (e) {
    return fail(e);
  }
}
