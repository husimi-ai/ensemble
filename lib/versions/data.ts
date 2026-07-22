"use server";

/**
 * Load a group's submitted versions for the in-room history panel (C13/C14).
 * Exposed as a server action so the client `VersionHistory` modal can lazy-load
 * it on open. Runs under the request RLS client: the task-001 `versions_select`
 * policy already scopes rows to accepted members + the operator, so a non-member
 * simply gets an empty list. Import via `@/lib/versions`.
 */
import { createClient } from "@/lib/supabase/server";
import type { VersionStatus } from "@/lib/types";
import type { GroupVersion } from "./types";

const BUCKET = "versions";
/** Signed-URL lifetime for paper/notes downloads (10 min; re-issued per load). */
const SIGNED_TTL = 60 * 10;

interface VersionRow {
  id: string;
  version_no: number;
  paper_ref: string | null;
  repo_ref: string | null;
  status: VersionStatus;
  feedback: string | null;
  created_at: string;
}

/** Signed download URL for a private-bucket object, or `null` if absent. */
async function signedUrl(
  supabase: ReturnType<typeof createClient>,
  path: string,
): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
  return data?.signedUrl ?? null;
}

export async function loadGroupVersions(groupId: string): Promise<GroupVersion[]> {
  if (!groupId) return [];
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("versions")
    .select("id,version_no,paper_ref,repo_ref,status,feedback,created_at")
    .eq("group_id", groupId)
    .order("version_no", { ascending: false });
  if (error || !data) return [];

  return Promise.all(
    (data as VersionRow[]).map(async (v) => {
      const [paperUrl, notesUrl] = await Promise.all([
        v.paper_ref ? signedUrl(supabase, v.paper_ref) : Promise.resolve(null),
        signedUrl(supabase, `${groupId}/v${v.version_no}/notes.md`),
      ]);
      return {
        id: v.id,
        versionNo: v.version_no,
        status: v.status,
        paperUrl,
        repoRef: v.repo_ref,
        notesUrl,
        feedback: v.feedback,
        createdAt: v.created_at,
      };
    }),
  );
}
