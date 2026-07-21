"use client";

import { ArrowUp, AudioLines, Mic, Plus } from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  useRef,
  useState,
} from "react";

export function Composer({ onSend }: { onSend: (text: string) => void }) {
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const canSend = value.trim().length > 0;

  function grow() {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!canSend) return;
    onSend(value.trim());
    setValue("");
    requestAnimationFrame(() => {
      if (taRef.current) taRef.current.style.height = "auto";
    });
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto flex w-full max-w-thread items-end gap-2 rounded-composer border border-line bg-elevated px-2.5 py-2 shadow-composer"
    >
      <button
        type="button"
        aria-label="Add attachment"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-fg hover:bg-hover"
      >
        <Plus size={20} />
      </button>

      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          grow();
        }}
        onKeyDown={onKey}
        rows={1}
        placeholder="Ask anything"
        className="max-h-[200px] flex-1 resize-none bg-transparent py-1.5 leading-[26px] text-fg placeholder:text-fg-muted focus:outline-none"
      />

      {canSend ? (
        <button
          type="submit"
          aria-label="Send"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-fg-inverted hover:bg-primary-hover"
        >
          <ArrowUp size={18} />
        </button>
      ) : (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="Dictate"
            className="grid h-9 w-9 place-items-center rounded-full text-fg hover:bg-hover"
          >
            <Mic size={20} />
          </button>
          <button
            type="button"
            aria-label="Voice mode"
            className="grid h-8 w-8 place-items-center rounded-full bg-primary text-fg-inverted hover:bg-primary-hover"
          >
            <AudioLines size={18} />
          </button>
        </div>
      )}
    </form>
  );
}
