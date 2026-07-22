import { LayoutDashboard } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";
import { isFounder } from "@/components/nav/founder";
import { getUser } from "@/lib/auth/user";

export const metadata: Metadata = { title: "Operator · Ensemble" };

/**
 * Founder-only operator console shell. The nav hides this for non-founders; the
 * route guards it too so a direct visit redirects away. Queue logic is task 015.
 */
export default async function OperatorPage() {
  const user = await getUser();
  if (!isFounder(user?.email)) redirect("/feed");

  return (
    <PagePlaceholder
      icon={LayoutDashboard}
      title="Operator console"
      description="Founder-only queue: review problem submissions, fulfil compute and data requests, and review submitted versions."
    />
  );
}
