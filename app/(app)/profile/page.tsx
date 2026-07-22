import { UserRound } from "lucide-react";
import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";
import { getUser } from "@/lib/auth/user";

export const metadata: Metadata = { title: "Profile · Ensemble" };

/** Profile shell. Investigated-profile fields + editing land in tasks 006/008. */
export default async function ProfilePage() {
  const user = await getUser();
  const who = user?.email ?? "your account";
  return (
    <PagePlaceholder
      icon={UserRound}
      title="Profile"
      description={`Your investigated profile for ${who} will appear here once onboarding completes — every field editable and source-tagged.`}
    />
  );
}
