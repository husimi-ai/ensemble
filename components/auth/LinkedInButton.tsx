"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * "Sign in with LinkedIn" via Supabase OIDC (linkedin_oidc). Scopes yield
 * id/name/email/photo only (F4) -- no work history, no scraping. The browser
 * client redirects to LinkedIn, which returns to /auth/callback.
 */
export function LinkedInButton({ next = "/" }: { next?: string }) {
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "linkedin_oidc",
      options: { redirectTo, scopes: "openid profile email" },
    });
    if (error) setLoading(false); // otherwise the browser navigates away
  }

  return (
    <button
      type="button"
      onClick={signIn}
      disabled={loading}
      className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-line bg-elevated text-sm font-medium text-fg hover:bg-hover disabled:opacity-60"
    >
      <span className="grid h-5 w-5 place-items-center rounded-[3px] bg-accent text-[11px] font-bold text-fg-inverted">
        in
      </span>
      Continue with LinkedIn
    </button>
  );
}
