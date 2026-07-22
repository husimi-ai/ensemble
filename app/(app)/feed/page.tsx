import { Home } from "lucide-react";
import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const metadata: Metadata = { title: "Feed · Ensemble" };

/** Home feed shell. Problem ranking + apply flow land in later tasks (009). */
export default function FeedPage() {
  return (
    <PagePlaceholder
      icon={Home}
      title="Feed"
      description="Problems matched to your profile will appear here, ranked and ready to apply."
    />
  );
}
