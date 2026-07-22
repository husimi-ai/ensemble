"use client";

/**
 * Operator queue -- pending problem submissions. Each card is editable (title,
 * description, subfield, and the comma-separated tag/role/skill lists) and
 * publishes draft/review -> published via the `publishProblem` action, which
 * flips `status` so the problem enters the feed (T3 supply).
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Problem } from "@/lib/types";
import { publishProblem } from "@/lib/operator/actions";
import {
  Card,
  Field,
  ListField,
  Note,
  parseList,
  PrimaryButton,
  Pill,
  Queue,
  TextArea,
} from "./parts";

export function ProblemReview({ problems }: { problems: Problem[] }) {
  return (
    <Queue title="Problem submissions" count={problems.length}>
      {problems.map((p) => (
        <ProblemCard key={p.id} problem={p} />
      ))}
    </Queue>
  );
}

function ProblemCard({ problem }: { problem: Problem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(problem.title);
  const [description, setDescription] = useState(problem.description);
  const [subfield, setSubfield] = useState(problem.subfield ?? "");
  const [tags, setTags] = useState(problem.tags.join(", "));
  const [roles, setRoles] = useState(problem.requiredRoles.join(", "));
  const [skills, setSkills] = useState(problem.requiredSkills.join(", "));

  function onPublish() {
    setNote(null);
    setError(null);
    startTransition(async () => {
      const res = await publishProblem({
        id: problem.id,
        title,
        description,
        subfield,
        tags: parseList(tags),
        requiredRoles: parseList(roles),
        requiredSkills: parseList(skills),
      });
      if ("error" in res) setError(res.error);
      else {
        setNote(res.note ?? "Published.");
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Pill>{problem.status}</Pill>
        <Pill>{problem.origin.replace("_", "-")}</Pill>
      </div>
      <div className="flex flex-col gap-3">
        <Field label="Title" value={title} onChange={setTitle} />
        <TextArea label="Description" value={description} onChange={setDescription} rows={3} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Subfield" value={subfield} onChange={setSubfield} />
          <ListField label="Tags (comma-separated)" value={tags} onChange={setTags} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ListField label="Required roles" value={roles} onChange={setRoles} />
          <ListField label="Required skills" value={skills} onChange={setSkills} />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <PrimaryButton onClick={onPublish} disabled={pending}>
          {pending ? "Publishing…" : "Publish to feed"}
        </PrimaryButton>
        <Note note={note} error={error} />
      </div>
    </Card>
  );
}
