import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Per-request server Supabase client (anon key + the request's auth cookies).
 * Call inside Server Components, Route Handlers, and Server Actions. RLS still
 * applies -- this is NOT the service-role client.
 *
 * `cookies()` is synchronous on Next.js 14.2. In a Server Component the cookie
 * store is read-only, so `setAll` is wrapped in try/catch; `middleware.ts`
 * refreshes the session cookie there instead.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component: middleware.ts handles the refresh.
          }
        },
      },
    },
  );
}
