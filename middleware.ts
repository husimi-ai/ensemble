import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/** Keep the Supabase auth session fresh on every matched request (@supabase/ssr). */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except Next internals and static assets, so the
     * session cookie is refreshed on real navigations/data requests. Task 003
     * adds route protection on top of this matcher.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
