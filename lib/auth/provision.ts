import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Idempotently ensure app rows exist on first sign-in. public.users is already
 * mirrored by the handle_new_user trigger (0002); we upsert it so an OAuth name
 * fills in, then guarantee the 1:1 profiles row for onboarding (008) / pipeline
 * (006). Runs as the authenticated user -- RLS *_self permits only own rows.
 */
export async function ensureAccountRows(supabase: SupabaseClient, user: User): Promise<void> {
  const meta = user.user_metadata ?? {};
  const name =
    (meta.name as string | undefined) ?? (meta.full_name as string | undefined) ?? null;

  await supabase.from("users").upsert(
    { id: user.id, email: user.email, name },
    { onConflict: "id" },
  );
  await supabase.from("profiles").upsert(
    { user_id: user.id },
    { onConflict: "user_id", ignoreDuplicates: true },
  );
}
