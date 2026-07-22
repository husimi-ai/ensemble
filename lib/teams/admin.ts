/**
 * Service-role Supabase client for the assembly writes (task 011). Assembly runs
 * as a batch trigger (operator action or schedule) and must insert a *proposed*
 * Group + pending Memberships and add the founder on activation -- writes the
 * anon-key RLS policies reserve for `is_operator()` / bypass entirely. Migration
 * 0006 says so explicitly: "worker/assembly inserts (... proposed memberships)
 * ... need no policy here" because the service_role key has BYPASSRLS.
 *
 * Server-only: reads `SUPABASE_SERVICE_ROLE_KEY`. NEVER import from client code.
 * Mirrors the lazy singleton in `lib/ai/relay.ts`.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;

/** Lazily-built service-role client (bypasses RLS; server-only key). */
export function adminClient(): SupabaseClient {
  if (admin) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "teams/admin: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set",
    );
  }
  admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
