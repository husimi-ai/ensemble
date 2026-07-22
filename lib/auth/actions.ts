"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthError = { error: string };

function requestOrigin(): string {
  const h = headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("host") ?? "localhost:3000";
  return `${h.get("x-forwarded-proto") ?? "http"}://${host}`;
}

/** Email + password sign-in. Redirects on success; returns { error } otherwise. */
export async function signInWithEmail(formData: FormData): Promise<AuthError | void> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password are required." };

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect(String(formData.get("next") ?? "/") || "/");
}

/** Email + password sign-up. Handles the email-confirmation case. */
export async function signUpWithEmail(formData: FormData): Promise<AuthError | void> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password are required." };

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: name ? { name } : undefined,
      emailRedirectTo: `${requestOrigin()}/auth/callback`,
    },
  });
  if (error) return { error: error.message };

  if (!data.session) redirect("/login?checkEmail=1");
  redirect("/");
}

/** Sign the current user out and return to /login. */
export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
