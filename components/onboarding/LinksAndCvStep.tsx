"use client";

import { useRef, useState } from "react";
import { FileText, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fileToCvPayload, uploadCv } from "@/lib/onboarding/client";
import type { StepProps } from "./types";
import { Art14Notice } from "./Art14Notice";
import { StepHeader, WizardNav } from "./StepChrome";

/**
 * Step 1 — collect the user's CV (uploaded to the `cvs` bucket) and any public
 * links. LinkedIn is only ever taken via "Sign in with LinkedIn" or an uploaded
 * export — never scraped. All fields optional; the pipeline degrades gracefully.
 */
export function LinksAndCvStep({ data, patch, userId, onNext }: StepProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const cv = await fileToCvPayload(file);
      let cvPath: string | null = null;
      if (userId) cvPath = await uploadCv(createClient(), userId, file);
      patch({ cv, cvFileName: file.name, cvPath });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that file.");
    } finally {
      setUploading(false);
    }
  }

  function setLink(i: number, value: string) {
    const links = [...data.links];
    links[i] = value;
    patch({ links });
  }
  function addLink() {
    patch({ links: [...data.links, ""] });
  }
  function removeLink(i: number) {
    patch({ links: data.links.filter((_, idx) => idx !== i) });
  }

  return (
    <div>
      <StepHeader
        title="Add your CV and links"
        description="These seed your profile. We read them together with open scholarly sources — you review everything before anything is saved."
      />

      <div className="flex flex-col gap-6">
        <div>
          <p className="mb-1.5 text-sm font-medium text-fg">CV or resumé</p>
          {data.cvFileName ? (
            <div className="flex items-center gap-3 rounded-lg border border-line bg-subtle px-3 py-2.5">
              <FileText size={18} className="shrink-0 text-fg-secondary" />
              <span className="min-w-0 flex-1 truncate text-sm text-fg">
                {data.cvFileName}
              </span>
              <button
                type="button"
                onClick={() => patch({ cv: null, cvFileName: null, cvPath: null })}
                className="grid h-7 w-7 place-items-center rounded-md text-fg-secondary hover:bg-hover"
                aria-label="Remove CV"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-line-heavy bg-elevated text-sm font-medium text-fg-secondary hover:bg-hover disabled:opacity-60"
            >
              <FileText size={16} />
              {uploading ? "Uploading…" : "Upload a PDF or text CV"}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,.md,application/pdf,text/plain"
            onChange={onFile}
            className="hidden"
          />
          {error ? <p className="mt-1.5 text-xs text-danger">{error}</p> : null}
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-fg">Public links</p>
          <p className="mb-2 text-xs text-fg-muted">
            A personal site, Google Scholar, a lab page — or your LinkedIn export.
            We never scrape LinkedIn.
          </p>
          <div className="flex flex-col gap-2">
            {data.links.map((link, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="url"
                  value={link}
                  placeholder="https://…"
                  onChange={(e) => setLink(i, e.target.value)}
                  className="h-10 flex-1 rounded-lg border border-line bg-elevated px-3 text-sm text-fg outline-none placeholder:text-fg-muted focus:border-line-heavy focus:ring-2 focus:ring-line-heavy"
                />
                <button
                  type="button"
                  onClick={() => removeLink(i)}
                  className="grid h-8 w-8 place-items-center rounded-md text-fg-secondary hover:bg-hover"
                  aria-label="Remove link"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addLink}
              className="flex w-fit items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-fg-secondary hover:bg-hover"
            >
              <Plus size={16} />
              Add a link
            </button>
          </div>
        </div>

        <Art14Notice compact />
      </div>

      <WizardNav onNext={onNext} nextLabel="Continue" busy={uploading} />
    </div>
  );
}
