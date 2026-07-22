import { Home } from "lucide-react";
import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";
import { requireUser } from "@/lib/auth";
import { matchProblemsForUser } from "@/lib/matching";
import { loadAppliedProblemIds } from "@/lib/teams";
import type { FeedProblemView } from "@/lib/teams";
import { FeedList } from "./FeedList";

export const metadata: Metadata = { title: "Feed · Ensemble" };

// The feed ranks live per request (matching engine + applied state); never cache.
export const dynamic = "force-dynamic";

/**
 * Home feed: rank published problems for the signed-in user with the 009 matching
 * engine, then let them apply (task 011). Ranking/scoring is 009's API; this page
 * only joins in the user's applied state and hands off to the apply list.
 */
export default async function FeedPage() {
  const user = await requireUser();
  const [matches, applied] = await Promise.all([
    matchProblemsForUser(user.id),
    loadAppliedProblemIds(),
  ]);

  const items: FeedProblemView[] = matches.map((m) => ({
    id: m.problem.id,
    title: m.problem.title,
    description: m.problem.description,
    subfield: m.problem.subfield,
    tags: m.problem.tags,
    fit: m.fit,
    proximity: m.proximity,
    score: m.score,
    applied: applied.has(m.problem.id),
  }));

  return (
    <PagePlaceholder
      icon={Home}
      title="Feed"
      description="Problems matched to your profile, ranked and ready to apply. Apply to join the pool; we'll assemble a balanced team when it's ready."
    >
      <FeedList items={items} />
    </PagePlaceholder>
  );
}
