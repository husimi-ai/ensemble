"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  indexProfile,
  ingestProfile,
  saveConfirmedProfile,
  type IngestedProfile,
} from "@/lib/onboarding/client";
import type { Confidence, Provenance, StitchedProfile } from "@/lib/profile/schema";
import type { SourceNote } from "@/lib/scholarly";
import type { OnboardingData, Patch } from "./types";
import { Art14Notice } from "./Art14Notice";
import { StepHeader } from "./StepChrome";
import { ProfileEditor } from "./review/ProfileEditor";

interface ReviewProps {
  data: OnboardingData;
  patch: Patch;
  onBack: () => void;
  onComplete: () => void;
}

/**
 * Step 4 — the mandatory show-and-correct screen. Runs /ingest against the
 * confirmed anchor, renders every field editable + source-tagged, then on Save
 * writes the confirmed profile (Art. 16) and triggers /api/profile/index (007).
 */
export function ReviewProfileStep({ data, patch, onBack, onComplete }: ReviewProps) {
  const started = useRef(false);
  const [loading, setLoading] = useState(true);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [notes, setNotes] = useState<SourceNote[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profile, setProfile] = useState<IngestedProfile | null>(null);
  const [provenance, setProvenance] = useState<Provenance | null>(null);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const res = await ingestProfile({
          name: data.name,
          authorId: data.authorId,
          orcid: data.orcid || data.picked?.orcid || null,
          institution: data.institution || data.picked?.institution || null,
          cv: data.cv,
          links: data.links.filter((l) => l.trim().length > 0),
        });
        setProfileId(res.profileId);
        setProfile(res.profile);
        setProvenance(res.provenance);
        setConfidence(res.confidence);
        setNotes(res.notes);
        patch({ ingest: res });
      } catch (err) {
        setIngestError(err instanceof Error ? err.message : "Investigation failed.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onChange<K extends keyof StitchedProfile>(key: K, value: StitchedProfile[K]) {
    setProfile((p) => (p ? { ...p, [key]: value } : p));
    setProvenance((pv) => (pv ? { ...pv, [key]: "user" } : pv));
    setConfidence((cf) => (cf ? { ...cf, [key]: 1 } : cf));
  }

  async function onSave() {
    if (!profileId || !profile || !provenance || !confidence) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveConfirmedProfile(createClient(), profileId, profile, provenance, confidence);
      await indexProfile(profileId).catch(() => null); // matchable async; non-fatal
      onComplete();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save your profile.");
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div>
        <StepHeader
          title="Building your profile"
          description="Reading open scholarly sources and stitching them with your CV. This takes a few seconds."
        />
        <div className="flex items-center gap-2 py-10 text-sm text-fg-secondary">
          <Loader2 size={18} className="animate-spin" />
          Investigating…
        </div>
      </div>
    );
  }

  if (ingestError || !profile || !provenance || !confidence) {
    return (
      <div>
        <StepHeader
          title="We hit a snag"
          description="The investigation could not complete. You can go back and try again."
        />
        <p className="text-sm text-danger">{ingestError ?? "No profile was produced."}</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-6 h-11 rounded-lg px-4 text-sm font-medium text-fg-secondary hover:bg-hover"
        >
          Back
        </button>
      </div>
    );
  }

  const failed = notes.filter((n) => !n.ok);

  return (
    <div>
      <StepHeader
        title="Review and correct your profile"
        description="This is what we assembled about you. Every field is editable and tagged with its source. Nothing is saved until you confirm."
      />

      <div className="flex flex-col gap-4">
        <Art14Notice />

        {failed.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-line bg-subtle px-3 py-2.5 text-xs text-fg-secondary">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-fg-muted" />
            <span>
              Some sources were unavailable ({failed.map((n) => n.source).join(", ")}).
              Your profile is partial — fill any gaps below.
            </span>
          </div>
        )}

        <ProfileEditor
          profile={profile}
          provenance={provenance}
          confidence={confidence}
          onChange={onChange}
        />
      </div>

      {saveError ? <p className="mt-4 text-sm text-danger">{saveError}</p> : null}

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={saving}
          className="h-11 rounded-lg px-4 text-sm font-medium text-fg-secondary hover:bg-hover disabled:opacity-60"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="h-11 rounded-lg bg-primary px-5 text-sm font-medium text-fg-inverted hover:bg-primary-hover disabled:opacity-60"
        >
          {saving ? "Saving…" : "Confirm & save profile"}
        </button>
      </div>
    </div>
  );
}
