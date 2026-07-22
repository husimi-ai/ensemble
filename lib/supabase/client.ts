import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client, bound to the public anon key. Safe to call
 * from Client Components. NEVER reference `SUPABASE_SERVICE_ROLE_KEY` here --
 * the service-role key is server-only (rules.md / task 002).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
