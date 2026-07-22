import type { Message as MessageT } from "@/lib/types";
import { Message } from "@/components/chat/Message";
import { type AuthorInfo, formatTimeLabel, startsNewGroup } from "@/components/chat/authorStyle";

type Props = {
  messages: MessageT[];
  /** Whose view this is -- passed through to `Message` to resolve "is this me". */
  currentUserId: string;
  /** senderId -> display info for human senders. */
  authors?: Record<string, AuthorInfo>;
  /** Display name for the shared AI participant. */
  aiName?: string;
};

/**
 * Lays out a room's `Message[]` as one scroll column: consecutive messages
 * from the same sender within a short window group together (identity +
 * timestamp shown once per group, tighter spacing within it).
 */
export function Thread({ messages, currentUserId, authors, aiName }: Props) {
  return (
    <div className="mx-auto flex w-full max-w-thread flex-col px-4 py-6">
      {messages.map((message, i) => {
        const isNewGroup = startsNewGroup(message, messages[i - 1]);
        return (
          <div key={message.id} className={isNewGroup ? "mt-5 first:mt-0" : "mt-0.5"}>
            {isNewGroup && (
              <div className="mb-2 text-center text-xs text-fg-muted">
                {formatTimeLabel(message.createdAt)}
              </div>
            )}
            <Message
              message={message}
              currentUserId={currentUserId}
              authors={authors}
              aiName={aiName}
              showAuthorHeader={isNewGroup}
            />
          </div>
        );
      })}
    </div>
  );
}
