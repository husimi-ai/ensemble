"use client";

/**
 * In-room "Submit version" (C13/C14): a group member uploads the paper to the
 * private `versions` Storage bucket, links the codebase repo URL, adds optional
 * cover notes, and the {@link submitVersion} server action inserts a `versions`
 * row (status `submitted`) with the next iterative `version_no`. Self-contained
 * trigger + modal, so RoomHeader only has to drop it in (task 016).
 */
import { Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Field,
  Note,
  PrimaryButton,
  SecondaryButton,
  TextArea,
} from "@/components/operator/parts";
import { Modal } from "@/components/ui/Modal";
import { submitVersion } from "@/lib/versions";

export function SubmitVersion({ roomId }: { roomId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setFile(null);
    setRepoUrl("");
    setNotes("");
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function submit() {
    setError(null);
    if (!file && !repoUrl.trim()) {
      setError("Attach a paper or a codebase repo URL.");
      return;
    }
    startTransition(async () => {
      const form = new FormData();
      form.set("groupId", roomId);
      form.set("repoUrl", repoUrl.trim());
      form.set("notes", notes.trim());
      if (file) form.set("paper", file);
      const res = await submitVersion(form);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-fg-inverted hover:bg-primary-hover"
      >
        <Upload size={14} />
        Submit version
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        labelledBy="submit-version-title"
        panelClassName="w-full max-w-lg rounded-2xl p-5"
      >
        <h2 id="submit-version-title" className="text-lg font-semibold text-fg">
          Submit a version
        </h2>
        <p className="mb-4 mt-1 text-sm text-fg-muted">
          Attach the paper and link the codebase. This enters the operator review
          queue for feedback (C13/C14).
        </p>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-fg-secondary">Paper</span>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 rounded-[10px] border border-line bg-elevated px-3 py-2 text-left text-sm text-fg hover:bg-hover"
            >
              <Upload size={16} className="shrink-0 text-fg-secondary" />
              <span className="min-w-0 truncate">
                {file ? file.name : "Choose a file (PDF, docx, tex…)"}
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,.md,.tex,.txt"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <Field
            label="Codebase repo URL"
            value={repoUrl}
            onChange={setRepoUrl}
            placeholder="https://github.com/group/project"
          />
          <TextArea
            label="Notes (optional)"
            value={notes}
            onChange={setNotes}
            placeholder="What changed since the last version, open questions…"
            rows={3}
          />
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <Note error={error} />
          <div className="flex items-center justify-end gap-3">
            <SecondaryButton onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </SecondaryButton>
            <PrimaryButton onClick={submit} disabled={pending}>
              {pending ? "Submitting…" : "Submit"}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </>
  );
}
