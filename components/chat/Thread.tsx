import type { ChatMessage } from "@/lib/types";
import { Message } from "@/components/chat/Message";

export function Thread({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="mx-auto flex w-full max-w-thread flex-col gap-6 px-4 py-6">
      {messages.map((m) => (
        <Message key={m.id} message={m} />
      ))}
    </div>
  );
}
