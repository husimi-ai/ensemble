"use client";

import { useState } from "react";
import { signInWithEmail, signUpWithEmail } from "@/lib/auth/actions";

type Mode = "login" | "signup";

/**
 * Email + password form for /login and /signup (via `mode`). Calls the Server
 * Actions directly; the action redirects on success and returns { error } on
 * failure. FormData is captured synchronously before await. Tokens only.
 */
export function EmailAuthForm({ mode, next = "/" }: { mode: Mode; next?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isSignup = mode === "signup";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const formData = new FormData(e.currentTarget);
    const res = await (isSignup ? signUpWithEmail : signInWithEmail)(formData);
    if (res?.error) { setError(res.error); setPending(false); }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      {isSignup ? <Field name="name" type="text" label="Name" autoComplete="name" /> : null}
      <Field name="email" type="email" label="Email address" autoComplete="email" required />
      <Field
        name="password"
        type="password"
        label="Password"
        autoComplete={isSignup ? "new-password" : "current-password"}
        required
      />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 h-11 rounded-lg bg-primary text-sm font-medium text-fg-inverted hover:bg-primary-hover disabled:opacity-60"
      >
        {isSignup ? "Create account" : "Continue"}
      </button>
    </form>
  );
}

function Field({
  label, name, type, autoComplete, required,
}: {
  label: string; name: string; type: string; autoComplete?: string; required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-fg">{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        className="h-11 rounded-lg border border-line bg-elevated px-3 text-sm text-fg outline-none placeholder:text-fg-muted focus:border-line-heavy focus:ring-2 focus:ring-line-heavy"
      />
    </label>
  );
}
