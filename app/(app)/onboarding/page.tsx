import type { Metadata } from "next";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export const metadata: Metadata = { title: "Onboarding · Ensemble" };

/**
 * Onboarding surface (T1): investigate the person from open scholarly sources,
 * confirm identity, then show-and-correct the provenance-tagged profile. The
 * wizard is a client state machine; all heavy work is behind the 006/007 routes.
 */
export default function OnboardingPage() {
  return <OnboardingWizard />;
}
