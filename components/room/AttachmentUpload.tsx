"use client";

import { Loader2, Paperclip } from "lucide-react";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Attachment } from "@/lib/types";

/** Storage bucket for in-room file sharing (RLS: room members, migration 0007). */
const BUCKET = "attachments";

/** Strip a filename to a storage-safe segment (keep it readable, drop path chars). */
function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "file";
}

/**
 * File picker that uploads to the private `attachments` bucket via a signed
 * upload URL, then hands the caller a persisted {@link Attachment} descriptor to
 * ride along with the next room message. The object path is `<roomId>/<uuid>-<name>`
 * so the bucket RLS (`foldername[1] == group_id`) authorizes the write.
 */
export function AttachmentUpload({
  roomId,
  disabled,
  onAttach,
}: {
  roomId: string;
  disabled?: boolean;
  onAttach: (attachment: Attachment) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    const supabase = createClient();
    const path = `${roomId}/${crypto.randomUUID()}-${safeName(file.name)}`;

    const { data: signed, error: signErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);
    if (signErr || !signed) {
      setError("Upload failed");
      return;
    }

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .uploadToSignedUrl(signed.path, signed.token, file);
    if (upErr) {
      setError("Upload failed");
      return;
    }

    onAttach({
      id: crypto.randomUUID(),
      bucket: BUCKET,
      path: signed.path,
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
    });
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await upload(file);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Attach a file"
        title={error ?? "Attach a file"}
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-fg hover:bg-hover disabled:opacity-40"
      >
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
      </button>
      <input ref={inputRef} type="file" className="hidden" onChange={onPick} />
    </>
  );
}
