"use client";

/**
 * Operator queue -- compute/data resource requests. A compute request is marked
 * fulfilled; a data request can instead be PUBLISHED, which creates a
 * `DataRequestListing` and runs the 009 provider-matching surface (C12). The
 * publish form (title/description/tags) prefills from the request.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fulfilRequest, publishDataRequest } from "@/lib/operator/actions";
import type { OperatorRequest } from "@/lib/operator/data";
import {
  Card,
  Field,
  ListField,
  Note,
  parseList,
  Pill,
  PrimaryButton,
  Queue,
  SecondaryButton,
  TextArea,
} from "./parts";

export function RequestQueue({ requests }: { requests: OperatorRequest[] }) {
  return (
    <Queue title="Resource requests" count={requests.length}>
      {requests.map((r) => (
        <RequestCard key={r.id} request={r} />
      ))}
    </Queue>
  );
}

function RequestCard({ request }: { request: OperatorRequest }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const defaultTitle =
    request.groupName ?? `${request.kind === "data" ? "Data" : "Compute"} request`;
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(request.description);
  const [tags, setTags] = useState("");

  function run(action: () => Promise<{ ok: true; note?: string } | { error: string }>) {
    setNote(null);
    setError(null);
    startTransition(async () => {
      const res = await action();
      if ("error" in res) setError(res.error);
      else {
        setNote(res.note ?? "Done.");
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <div className="mb-2 flex items-center gap-2">
        <Pill>{request.kind}</Pill>
        <Pill>{request.status}</Pill>
        {request.groupName ? (
          <span className="text-xs text-fg-muted">{request.groupName}</span>
        ) : null}
      </div>
      <p className="text-sm text-fg">
        {request.description || <span className="text-fg-muted">No description.</span>}
      </p>

      {publishing && request.kind === "data" ? (
        <div className="mt-3 flex flex-col gap-3 rounded-[10px] border border-line-light bg-subtle p-3">
          <Field label="Listing title" value={title} onChange={setTitle} />
          <TextArea label="Listing description" value={description} onChange={setDescription} rows={3} />
          <ListField label="Tags (comma-separated)" value={tags} onChange={setTags} />
          <div className="flex items-center gap-3">
            <PrimaryButton
              disabled={pending}
              onClick={() =>
                run(() =>
                  publishDataRequest({
                    requestId: request.id,
                    title,
                    description,
                    tags: parseList(tags),
                  }),
                )
              }
            >
              {pending ? "Publishing…" : "Publish listing & match"}
            </PrimaryButton>
            <SecondaryButton onClick={() => setPublishing(false)} disabled={pending}>
              Cancel
            </SecondaryButton>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-3">
          <SecondaryButton
            onClick={() => run(() => fulfilRequest(request.id))}
            disabled={pending}
          >
            {pending ? "Saving…" : "Mark fulfilled"}
          </SecondaryButton>
          {request.kind === "data" ? (
            <PrimaryButton onClick={() => setPublishing(true)} disabled={pending}>
              Publish data request
            </PrimaryButton>
          ) : null}
        </div>
      )}

      <div className="mt-2">
        <Note note={note} error={error} />
      </div>
    </Card>
  );
}
