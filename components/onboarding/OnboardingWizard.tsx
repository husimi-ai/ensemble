"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useSession } from "@/app/providers";
import { emptyOnboardingData, type OnboardingData } from "./types";
import { LinksAndCvStep } from "./LinksAndCvStep";
import { QuestionsStep } from "./QuestionsStep";
import { IsThisYouStep } from "./IsThisYouStep";
import { ReviewProfileStep } from "./ReviewProfileStep";

const STEPS = ["Links & CV", "About you", "Is this you?", "Review"] as const;

/**
 * The onboarding state machine (T1): four steps from raw inputs to a confirmed,
 * provenance-tagged profile. Holds the collected data + current step; each step
 * is presentational and calls the 006/007 endpoints via lib/onboarding/client.
 */
export function OnboardingWizard() {
  const session = useSession();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(() => ({
    ...emptyOnboardingData,
    name: session?.name ?? "",
  }));

  const patch = useMemo(
    () => (partial: Partial<OnboardingData>) => setData((d) => ({ ...d, ...partial })),
    [],
  );
  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const shared = { data, patch, userId: session?.id ?? null, onNext: next, onBack: back };

  return (
    <div className="mx-auto flex w-full max-w-thread flex-col px-4 py-8 sm:py-12">
      <Stepper current={step} />
      <div className="mt-8">
        {step === 0 && <LinksAndCvStep {...shared} />}
        {step === 1 && <QuestionsStep {...shared} />}
        {step === 2 && <IsThisYouStep {...shared} />}
        {step === 3 && (
          <ReviewProfileStep
            data={data}
            patch={patch}
            onBack={back}
            onComplete={() => router.push("/feed")}
          />
        )}
      </div>
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-medium ${
                active
                  ? "bg-primary text-fg-inverted"
                  : done
                    ? "bg-muted text-fg"
                    : "bg-muted text-fg-muted"
              }`}
            >
              {done ? <Check size={13} /> : i + 1}
            </span>
            <span
              className={`hidden text-xs sm:inline ${
                active ? "font-medium text-fg" : "text-fg-muted"
              }`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <span className="mx-1 h-px w-4 bg-line sm:w-8" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
