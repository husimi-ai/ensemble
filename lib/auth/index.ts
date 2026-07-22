/** Auth public surface (Supabase Auth: email + LinkedIn OIDC). Import via @/lib/auth. */
export { getUser, requireUser } from "./user";
export { signInWithEmail, signUpWithEmail, signOut, type AuthError } from "./actions";
export { ensureAccountRows } from "./provision";
