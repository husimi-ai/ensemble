import type { ChatMessage } from "@/lib/types";
import { MessageActions } from "@/components/chat/MessageActions";

export function Message({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="group flex flex-col items-end">
        <div className="max-w-[512px] whitespace-pre-wrap rounded-3xl bg-bubble px-5 py-2.5 text-fg">
          {message.content}
        </div>
        <MessageActions role="user" content={message.content} />
      </div>
    );
  }

  return (
    <div className="group">
      <div className="whitespace-pre-wrap leading-7 text-fg">{message.content}</div>
      <MessageActions role="assistant" content={message.content} />
    </div>
  );
}
