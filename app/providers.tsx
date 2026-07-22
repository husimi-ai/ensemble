"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * The current session, projected to a small serializable shape the client tree
 * can read without prop-drilling. `null` when signed out. The Supabase auth
 * user is resolved server-side (root layout) and handed in here; realtime /
 * data-query providers can join this file as the app grows.
 */
export type SessionUser = {
  id: string;
  email: string;
  name: string;
  isFounder: boolean;
} | null;

const SessionContext = createContext<SessionUser>(null);

/** The current authenticated user (or null) for any client component. */
export function useSession(): SessionUser {
  return useContext(SessionContext);
}

/** Top-level client providers, wired once in the root layout. */
export function Providers({
  user,
  children,
}: {
  user: SessionUser;
  children: ReactNode;
}) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}
