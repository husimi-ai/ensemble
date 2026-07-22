/**
 * Operator (founder) authorization guard -- server-only. Every operator loader
 * and action funnels through {@link requireOperator} so the console can never be
 * read or mutated by a non-founder. RLS (task 001 `is_operator()`) is the real
 * enforcement on every write; this is the defense-in-depth application check that
 * fails closed *before* a query runs and gives callers a clean signal.
 *
 * Operator == the DB `users.is_operator` flag OR the founder email (matching the
 * 004 route shell, which gates on `isFounder` until the DB flag is provisioned).
 * Import via `@/lib/operator/guard`.
 */
import { createClient } from "@/lib/supabase/server";
import { isFounder } from "@/components/nav/founder";

/** Thrown when a non-operator reaches an operator loader/action. */
export class OperatorForbiddenError extends Error {
  constructor() {
    super("Operator access required.");
    this.name = "OperatorForbiddenError";
  }
}

/** True when the signed-in caller is the operator/founder. Server-only. */
export async function isOperator(): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  if (isFounder(user.email)) return true;
  const { data } = await supabase
    .from("users")
    .select("is_operator")
    .eq("id", user.id)
    .maybeSingle();
  return Boolean(data?.is_operator);
}

/**
 * Assert the caller is the operator and hand back the RLS-scoped client + user id.
 * Throws {@link OperatorForbiddenError} otherwise (callers turn that into a
 * redirect at the route boundary or an `{ error }` result in an action).
 */
export async function requireOperator(): Promise<{
  supabase: ReturnType<typeof createClient>;
  userId: string;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new OperatorForbiddenError();
  if (!isFounder(user.email)) {
    const { data } = await supabase
      .from("users")
      .select("is_operator")
      .eq("id", user.id)
      .maybeSingle();
    if (!data?.is_operator) throw new OperatorForbiddenError();
  }
  return { supabase, userId: user.id };
}
