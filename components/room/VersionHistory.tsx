"use client";

/**
 * In-room version history (C13/C14): the group's submitted versions with their
 * lifecycle status, paper/repo/notes links, and any operator feedback. Lazy-
 * loads via {@link loadGroupVersions} when the panel opens. Self-contained
 * trigger + modal, so RoomHeader only has to drop it in (task 016).
 */
import { History } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { Modal } from "@/components/ui/Modal";
import type { VersionStatus } from "@/lib/types";
import { type GroupVersion, loadGroupVersions } from "@/lib/versions";

const STATUS_LABEL: Record<VersionStatus, string> = {
  submitted: "Submitted",
  feedback: "Feedback",
  taken_over: "Taken over",
  published: "Published",
};

export function VersionHistory({ groupId }: { groupId: string }) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<GroupVersion[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setVersions(await loadGroupVersions(groupId));
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  return (
    <>
      <IconButton label="Version history" onClick={() => setOpen(true)}>
        <History size={18} />
      </IconButton>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        labelledBy="version-history-title"
        panelClassName="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl"
      >
        <div className="border-b border-line-light px-5 py-4">
          <h2 id="version-history-title" className="text-lg font-semibold text-fg">
            Version history
          </h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading && versions === null ? (
            <p className="text-sm text-fg-muted">Loading…</p>
          ) : versions && versions.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {versions.map((v) => (
                <VersionItem key={v.id} version={v} label={STATUS_LABEL[v.status]} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg-muted">No versions submitted yet.</p>
          )}
        </div>
      </Modal>
    </>
  );
}

function VersionItem({ version, label }: { version: GroupVersion; label: string }) {
  const date = new Date(version.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <li className="rounded-xl border border-line bg-elevated p-3">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-fg-secondary">
          v{version.versionNo}
        </span>
        <span className="rounded-full bg-subtle px-2 py-0.5 text-xs font-medium text-fg-secondary">
          {label}
        </span>
        <span className="ml-auto text-xs text-fg-muted">{date}</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {version.paperUrl ? (
          <a
            href={version.paperUrl}
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            Paper
          </a>
        ) : (
          <span className="text-fg-muted">No paper</span>
        )}
        {version.repoRef ? (
          <a
            href={version.repoRef}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 max-w-full truncate text-accent hover:underline"
          >
            Codebase
          </a>
        ) : null}
        {version.notesUrl ? (
          <a
            href={version.notesUrl}
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            Notes
          </a>
        ) : null}
      </div>

      {version.feedback ? (
        <p className="mt-2 rounded-[10px] bg-subtle px-3 py-2 text-sm text-fg-secondary">
          <span className="font-medium text-fg">Feedback: </span>
          {version.feedback}
        </p>
      ) : null}
    </li>
  );
}
