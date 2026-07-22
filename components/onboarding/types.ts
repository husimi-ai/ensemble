import type { CvPayload, IngestResponse } from "@/lib/onboarding/client";
import type { ScholarlyAuthorHit } from "@/lib/scholarly";

/** Everything the wizard collects across its four steps (client-only state). */
export interface OnboardingData {
  /** Identity (drives /resolve + /ingest). */
  name: string;
  institution: string;
  orcid: string;
  /** Public links the user asserts (parsed server-side, never scraped). */
  links: string[];
  /** CV content for /ingest, plus its display name + Storage path. */
  cv: CvPayload | null;
  cvFileName: string | null;
  cvPath: string | null;
  /** The confirmed "Is this you?" author, and the OpenAlex anchor it yields. */
  picked: ScholarlyAuthorHit | null;
  authorId: string | null;
  /** The stitched, provenance-tagged result once /ingest has run. */
  ingest: IngestResponse | null;
}

export const emptyOnboardingData: OnboardingData = {
  name: "",
  institution: "",
  orcid: "",
  links: [],
  cv: null,
  cvFileName: null,
  cvPath: null,
  picked: null,
  authorId: null,
  ingest: null,
};

export type Patch = (partial: Partial<OnboardingData>) => void;

/** Props shared by every wizard step. */
export interface StepProps {
  data: OnboardingData;
  patch: Patch;
  userId: string | null;
  onNext: () => void;
  onBack: () => void;
}
