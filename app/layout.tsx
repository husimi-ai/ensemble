import type { Metadata } from "next";
import type { ReactNode } from "react";
import { isFounder } from "@/components/nav/founder";
import { getUser } from "@/lib/auth/user";
import { Providers, type SessionUser } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ensemble",
  description: "Ensemble — a medical-first research venture studio.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const authUser = await getUser();
  const meta = (authUser?.user_metadata ?? {}) as Record<string, unknown>;
  const name =
    (meta.name as string | undefined) ??
    (meta.full_name as string | undefined) ??
    authUser?.email?.split("@")[0] ??
    "";
  const user: SessionUser = authUser
    ? {
        id: authUser.id,
        email: authUser.email ?? "",
        name: name || "You",
        isFounder: isFounder(authUser.email),
      }
    : null;

  return (
    <html lang="en">
      <body>
        <Providers user={user}>{children}</Providers>
      </body>
    </html>
  );
}
