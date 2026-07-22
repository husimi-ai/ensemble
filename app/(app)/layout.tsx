import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { requireUser } from "@/lib/auth/user";

/**
 * The authed product shell. Middleware already gates these routes; `requireUser`
 * is defense-in-depth and guarantees a session before the chrome renders. The
 * session itself flows to client components via the root `Providers`.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireUser();
  return <AppShell>{children}</AppShell>;
}
