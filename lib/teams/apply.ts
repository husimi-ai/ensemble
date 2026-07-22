"use server";

/**
 * Apply to a recommended problem (task 011, feed action). Creates an
 * `applications` row for the signed-in user with `role` = their classified
 * profile role (T1); the row is the pre-assembly step that becomes a membership.
 * Re-applying an `unmatched` application re-queues it as `pending` -- the C16
 * retry -- via the `(problem_id, user_id)` upsert.
 *
 * Runs under the request RLS client: `applications_self` lets a user write only
 * their own row, so `user_id` is always the caller. Import via `@/lib/teams`.
 */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRole } from "@/lib/types";
import type { ActionResult } from "./types";

export async function applyToProblem(problemId: string): Promise<ActionResult> {
  try {
    if (!problemId) return { error: "Missing problem." };
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Sign in to apply." };

    // The classified role from the user's profile (nullable until onboarding
    // classification lands); stored on the application as the apply-time role.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const role = (profile?.role as ProfileRole | null) ?? null;

    const { error } = await supabase.from("applications").upsert(
      { problem_id: problemId, user_id: user.id, role, status: "pending" },
      { onConflict: "problem_id,user_id" },
    );
    if (error) return { error: error.message };

    revalidatePath("/feed");
    return {
      ok: true,
      note: role
        ? "Applied -- you'll be matched when a team forms."
        : "Applied. Finish onboarding so we can classify your role.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not apply." };
  }
}
