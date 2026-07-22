"use client";

import type {
  Confidence,
  Provenance,
  Publication,
  SourceKind,
  StitchedProfile,
} from "@/lib/profile/schema";
import type { IngestedProfile } from "@/lib/onboarding/client";
import { EditableField } from "./EditableField";
import { ListField } from "./ListField";
import { PublicationList } from "./PublicationList";

type Key = keyof StitchedProfile;

/**
 * The show-and-correct editor: every stitched field, editable and source-tagged
 * (GDPR Art. 14 transparency + Art. 16 rectification). It owns no state — the
 * parent step holds the working profile and flips edited fields to "user".
 */
export function ProfileEditor({
  profile,
  provenance,
  confidence,
  onChange,
}: {
  profile: IngestedProfile;
  provenance: Provenance;
  confidence: Confidence;
  onChange: <K extends Key>(key: K, value: StitchedProfile[K]) => void;
}) {
  const src = (k: Key): SourceKind | null => provenance[k] ?? null;
  const conf = (k: Key): number | null => confidence[k] ?? null;
  const str = (v: string | null) => v ?? "";
  const orNull = (v: string) => (v.trim() === "" ? null : v);
  const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

  return (
    <div>
      <Section title="About you" />
      <EditableField
        label="Headline"
        value={str(profile.headline)}
        onChange={(v) => onChange("headline", orNull(v))}
        source={src("headline")}
        confidence={conf("headline")}
        placeholder="One line on who you are professionally"
      />
      <EditableField
        label="Bio"
        value={str(profile.bio)}
        onChange={(v) => onChange("bio", orNull(v))}
        source={src("bio")}
        confidence={conf("bio")}
        multiline
      />

      <Section title="Expertise" />
      <ListField
        label="Research topics"
        values={profile.topics}
        onChange={(v) => onChange("topics", v)}
        source={src("topics")}
        confidence={conf("topics")}
      />
      <ListField
        label="Skills & methods"
        values={profile.skills}
        onChange={(v) => onChange("skills", v)}
        source={src("skills")}
        confidence={conf("skills")}
      />
      <ListField
        label="Resources you control"
        values={profile.resources}
        onChange={(v) => onChange("resources", v)}
        source={src("resources")}
        confidence={conf("resources")}
        placeholder="e.g. a cohort dataset, GPU cluster — never personal health data"
      />
      <PublicationList
        value={profile.publications as Publication[]}
        onChange={(v) => onChange("publications", v)}
        source={src("publications")}
        confidence={conf("publications")}
      />

      <Section title="Affiliation & location" />
      <EditableField
        label="Institution"
        value={str(profile.institutionName)}
        onChange={(v) => onChange("institutionName", orNull(v))}
        source={src("institutionName")}
        confidence={conf("institutionName")}
      />
      <EditableField
        label="City"
        value={str(profile.city)}
        onChange={(v) => onChange("city", orNull(v))}
        source={src("city")}
        confidence={conf("city")}
      />
      <EditableField
        label="Country"
        value={str(profile.country)}
        onChange={(v) => onChange("country", orNull(v))}
        source={src("country")}
        confidence={conf("country")}
      />
      <EditableField
        label="Latitude"
        value={profile.latitude == null ? "" : String(profile.latitude)}
        onChange={(v) => onChange("latitude", numOrNull(v))}
        source={src("latitude")}
        confidence={conf("latitude")}
        numeric
      />
      <EditableField
        label="Longitude"
        value={profile.longitude == null ? "" : String(profile.longitude)}
        onChange={(v) => onChange("longitude", numOrNull(v))}
        source={src("longitude")}
        confidence={conf("longitude")}
        numeric
      />

      <Section title="Identifiers" />
      <EditableField
        label="ORCID iD"
        value={str(profile.orcid)}
        onChange={(v) => onChange("orcid", orNull(v))}
        source={src("orcid")}
        confidence={conf("orcid")}
      />
      <EditableField
        label="OpenAlex id"
        value={str(profile.openalexId)}
        onChange={(v) => onChange("openalexId", orNull(v))}
        source={src("openalexId")}
        confidence={conf("openalexId")}
      />
    </div>
  );
}

function Section({ title }: { title: string }) {
  return (
    <p className="mt-6 text-sm font-semibold text-fg first:mt-0">{title}</p>
  );
}
