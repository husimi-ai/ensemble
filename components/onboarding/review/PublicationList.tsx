"use client";

import { Plus, Trash2 } from "lucide-react";
import type { Publication, SourceKind } from "@/lib/profile/schema";
import { SourceTag } from "./SourceTag";

/**
 * Editable, source-tagged publication list. Each row exposes title, year and
 * venue; rows can be added or removed. Any change flips provenance to "user".
 */
export function PublicationList({
  value,
  onChange,
  source,
  confidence,
}: {
  value: Publication[];
  onChange: (next: Publication[]) => void;
  source: SourceKind | null;
  confidence: number | null;
}) {
  function patchRow(i: number, partial: Partial<Publication>) {
    onChange(value.map((p, idx) => (idx === i ? { ...p, ...partial } : p)));
  }

  return (
    <div className="border-b border-line-light py-4">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-fg">Publications</span>
        <SourceTag source={source} confidence={confidence} />
      </div>
      <div className="flex flex-col gap-2.5">
        {value.map((pub, i) => (
          <div
            key={i}
            className="rounded-lg border border-line bg-subtle p-2.5"
          >
            <div className="flex items-start gap-2">
              <input
                value={pub.title}
                placeholder="Title"
                onChange={(e) => patchRow(i, { title: e.target.value })}
                className="min-w-0 flex-1 rounded-md border border-line bg-elevated px-2.5 py-1.5 text-sm text-fg outline-none focus:border-line-heavy"
              />
              <button
                type="button"
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-fg-muted hover:bg-hover"
                aria-label="Remove publication"
              >
                <Trash2 size={15} />
              </button>
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="number"
                value={pub.year ?? ""}
                placeholder="Year"
                onChange={(e) =>
                  patchRow(i, {
                    year: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-24 rounded-md border border-line bg-elevated px-2.5 py-1.5 text-sm text-fg outline-none focus:border-line-heavy"
              />
              <input
                value={pub.venue ?? ""}
                placeholder="Venue"
                onChange={(e) => patchRow(i, { venue: e.target.value || null })}
                className="min-w-0 flex-1 rounded-md border border-line bg-elevated px-2.5 py-1.5 text-sm text-fg outline-none focus:border-line-heavy"
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            onChange([...value, { title: "", year: null, doi: null, venue: null }])
          }
          className="flex w-fit items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-fg-secondary hover:bg-hover"
        >
          <Plus size={16} />
          Add a publication
        </button>
      </div>
    </div>
  );
}
