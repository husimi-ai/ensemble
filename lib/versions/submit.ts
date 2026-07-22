"use server";

/**
 * Submit a new version for a group (C13/C14). A room member attaches the paper
 * (stored in the private `versions` bucket), the codebase repo URL, and optional
 * cover notes; this inserts a `versions` row (status `submitted`) with the next
 * iterative `version_no`. Runs under the request RLS client, so the task-001
 * `versions_insert` / `versions_member_write` policies gate the write and the
 * upload to accepted group members. Import via `@/lib/versions`.
 *
 * The 001 schema has no notes column, so cover notes ride along as a companion
 * `notes.md` object in the same version folder (`<groupId>/v<n>/`), which keeps
 * them member/operator-readable without a schema change.
 */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SubmitResult } from "./types";

const BUCKET = "versions";
const MAX_ATTEMPTS = 3;

/** Strip a filename to a storage-safe segment (readable, no path chars). */
function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "paper";
}

export async function submitVersion(form: FormData): Promise<SubmitResult> {
  try {
    const groupId = String(form.get("groupId") ?? "").trim();
    const repoUrl = String(form.get("repoUrl") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim();
    const raw = form.get("paper");
    const paper = raw instanceof File && raw.size > 0 ? raw : null;

    if (!groupId) return { error: "Missing room." };
    if (!paper && !repoUrl) {
      return { error: "Attach a paper or a codebase repo URL." };
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Sign in to submit a version." };

    const fileId = crypto.randomUUID();
    let versionNo = 0;
    let versionId = "";
    let paperRef: string | null = null;

    // Reserve the next iterative version_no (max + 1), retrying on the
    // unique(group_id, version_no) race so two near-simultaneous submits settle.
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const { data: last } = await supabase
        .from("versions")
        .select("version_no")
        .eq("group_id", groupId)
        .order("version_no", { ascending: false })
        .limit(1)
        .maybeSingle();
      versionNo = (last?.version_no ?? 0) + 1;
      paperRef = paper ? `${groupId}/v${versionNo}/${fileId}-${safeName(paper.name)}` : null;

      const { data: row, error } = await supabase
        .from("versions")
        .insert({
          group_id: groupId,
          version_no: versionNo,
          paper_ref: paperRef,
          repo_ref: repoUrl || null,
          status: "submitted",
        })
        .select("id")
        .single();

      if (!error && row) {
        versionId = row.id as string;
        break;
      }
      // 23505 = unique_violation: another submit claimed this version_no; retry.
      if (error?.code === "23505" && attempt < MAX_ATTEMPTS - 1) continue;
      return { error: error?.message ?? "Could not submit this version." };
    }
    if (!versionId) return { error: "Could not submit this version." };

    // Store the paper now that version_no is reserved. If the upload fails the
    // row would dangle, so roll it back and surface the error.
    if (paper && paperRef) {
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(paperRef, paper, {
          contentType: paper.type || "application/octet-stream",
          upsert: true,
        });
      if (upErr) {
        await supabase.from("versions").delete().eq("id", versionId);
        return { error: "Could not upload the paper." };
      }
    }

    // Cover notes are best-effort (no notes column in 001); never fail on them.
    if (notes) {
      await supabase.storage
        .from(BUCKET)
        .upload(`${groupId}/v${versionNo}/notes.md`, new Blob([notes], { type: "text/markdown" }), {
          contentType: "text/markdown",
          upsert: true,
        });
    }

    // Surface the new submission in the operator review queue on its next load.
    revalidatePath("/operator");
    return { ok: true, versionNo };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not submit this version." };
  }
}
