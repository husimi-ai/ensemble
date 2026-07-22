/**
 * Shared shapes for the in-room version endgame (C13/C14). Kept free of
 * `next/headers` / server-only imports so the client room surfaces
 * (`components/room/SubmitVersion`, `VersionHistory`) can import them without
 * pulling the server Supabase client into their bundle. Import via
 * `@/lib/versions`.
 */
import type { VersionStatus } from "@/lib/types";

/** Result of a version submission (mirrors the operator/teams `ActionResult`). */
export type SubmitResult = { ok: true; versionNo: number } | { error: string };

/**
 * One of a group's submitted versions, shaped for the in-room history panel.
 * Row-derived from `versions`; `paperRef`/notes are resolved into short-lived
 * signed download URLs (the `versions` bucket is private, members-read).
 */
export interface GroupVersion {
  id: string;
  versionNo: number;
  status: VersionStatus;
  /** Signed download URL for the stored paper, or `null` when none was attached. */
  paperUrl: string | null;
  /** External codebase reference (repo URL) as submitted. */
  repoRef: string | null;
  /** Signed URL for the optional cover-notes companion object, if present. */
  notesUrl: string | null;
  /** Operator feedback once reviewed (C13/C14), else `null`. */
  feedback: string | null;
  createdAt: string;
}
