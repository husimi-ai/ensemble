import { Paperclip, Sparkles } from "lucide-react";
import type { Attachment, Message as MessageT } from "@/lib/types";
import { MessageActions } from "@/components/chat/MessageActions";
import { type AuthorInfo, displayName, initialOf, kindLabel } from "@/components/chat/authorStyle";

type Props = {
  message: MessageT;
  /** Who's viewing -- decides which human messages render as "own" (right-aligned). */
  currentUserId: string;
  /** senderId -> display info for human senders; `Message` itself has no name/avatar. */
  authors?: Record<string, AuthorInfo>;
  /** Display name for the shared AI participant. */
  aiName?: string;
  /** False when grouped under the message above (same sender, no gap) -- omits the identity row. */
  showAuthorHeader?: boolean;
};

/**
 * Renders one room message by `senderKind`: own human = right-aligned bubble,
 * other human = left-aligned bubble with avatar + name, AI = full-width block
 * (richer card for research_result/work_guide), system = a centered subtle line.
 */
export function Message({
  message,
  currentUserId,
  authors,
  aiName = "Ensemble",
  showAuthorHeader = true,
}: Props) {
  if (message.senderKind === "system") {
    return <div className="py-1 text-center text-xs text-fg-muted">{message.content}</div>;
  }

  if (message.senderKind === "ai") {
    return (
      <div className="group w-full">
        {showAuthorHeader && (
          <div className="mb-1.5 flex items-center gap-2">
            <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-fg-inverted">
              <Sparkles size={13} />
            </div>
            <span className="text-sm font-semibold text-fg">{aiName}</span>
          </div>
        )}
        <AiBody message={message} />
        <AttachmentList attachments={message.attachments} />
        <MessageActions senderKind="ai" isOwn={false} content={message.content} />
      </div>
    );
  }

  const isOwn = message.senderId === currentUserId;
  const name = displayName(message, authors, aiName);
  const avatarUrl = authors?.[message.senderId]?.avatarUrl;

  return (
    <div className={`group flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
      {!isOwn && showAuthorHeader && (
        <div className="mb-1 flex items-center gap-2 pl-1">
          <Avatar name={name} avatarUrl={avatarUrl} />
          <span className="text-sm font-medium text-fg">{name}</span>
        </div>
      )}
      <div className="max-w-[512px] whitespace-pre-wrap rounded-3xl bg-bubble px-5 py-2.5 text-fg">
        {message.content}
      </div>
      <AttachmentList attachments={message.attachments} />
      <MessageActions senderKind="human" isOwn={isOwn} content={message.content} />
    </div>
  );
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- presentational only, no next/image config here
    return <img src={avatarUrl} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />;
  }
  return (
    <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-medium text-fg-secondary">
      {initialOf(name)}
    </div>
  );
}

function AiBody({ message }: { message: MessageT }) {
  const label = kindLabel(message.kind);
  if (!label) {
    return <div className="whitespace-pre-wrap leading-7 text-fg">{message.content}</div>;
  }
  return (
    <div className="rounded-xl border border-line bg-subtle p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">{label}</div>
      <div className="whitespace-pre-wrap leading-7 text-fg">{message.content}</div>
    </div>
  );
}

function AttachmentList({ attachments }: { attachments: Attachment[] }) {
  if (!attachments.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {attachments.map((a) => (
        <span
          key={a.id}
          className="flex items-center gap-1.5 rounded-lg border border-line-light bg-subtle px-2.5 py-1 text-xs text-fg-secondary"
        >
          <Paperclip size={12} />
          {a.name}
        </span>
      ))}
    </div>
  );
}
