"use client";

import type { StepProps } from "./types";
import { StepHeader, TextField, WizardNav } from "./StepChrome";

/**
 * Step 2 — a few questions that anchor identity resolution: name (required),
 * current institution, and an optional ORCID iD. These drive the "Is this you?"
 * disambiguation (/resolve) and the investigation anchor (/ingest).
 */
export function QuestionsStep({ data, patch, onNext, onBack }: StepProps) {
  const canContinue = data.name.trim().length > 0;

  return (
    <div>
      <StepHeader
        title="A few quick questions"
        description="This helps us find the right you across the open scholarly record. Only your name is required."
      />

      <div className="flex flex-col gap-5">
        <TextField
          label="Full name"
          value={data.name}
          onChange={(name) => patch({ name })}
          placeholder="Jane Doe"
        />
        <TextField
          label="Current institution"
          value={data.institution}
          onChange={(institution) => patch({ institution })}
          placeholder="e.g. Karolinska Institutet"
          hint="Narrows the match when several researchers share your name."
        />
        <TextField
          label="ORCID iD"
          value={data.orcid}
          onChange={(orcid) => patch({ orcid })}
          placeholder="0000-0002-1825-0097"
          hint="Optional, but the most reliable anchor if you have one."
        />
      </div>

      <WizardNav
        onBack={onBack}
        onNext={onNext}
        nextLabel="Find my profile"
        nextDisabled={!canContinue}
      />
    </div>
  );
}
