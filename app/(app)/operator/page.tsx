import { LayoutDashboard } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";
import { OperatorConsole } from "@/components/operator/OperatorConsole";
import { isOperator } from "@/lib/operator/guard";
import { loadOperatorQueues } from "@/lib/operator/data";

export const metadata: Metadata = { title: "Operator · Ensemble" };

// The console reads live queues per request; never statically cache it.
export const dynamic = "force-dynamic";

/**
 * Founder-only operator console (C7/C11/C12). Route-guarded server-side: a
 * non-operator is redirected to the feed before any queue loads (RLS is the
 * second gate on every read/write). Renders the tabbed queue over the three
 * loaded lists.
 */
export default async function OperatorPage() {
  if (!(await isOperator())) redirect("/feed");

  const queues = await loadOperatorQueues();

  return (
    <PagePlaceholder
      icon={LayoutDashboard}
      title="Operator console"
      description="Founder-only queue: review and publish problem submissions, fulfil or publish resource requests, and review submitted versions."
    >
      <OperatorConsole queues={queues} />
    </PagePlaceholder>
  );
}
