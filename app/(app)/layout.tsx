import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { requireUser } from "@/lib/auth/user";
import { loadMyRooms } from "@/lib/rooms";

/**
 * The authed product shell. Middleware already gates these routes; `requireUser`
 * is defense-in-depth and guarantees a session before the chrome renders. The
 * session itself flows to client components via the root `Providers`; the user's
 * rooms are loaded here (server, RLS-scoped) and handed to the sidebar.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireUser();
  const rooms = await loadMyRooms();
  return <AppShell rooms={rooms}>{children}</AppShell>;
}
