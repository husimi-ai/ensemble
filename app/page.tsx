"use client";

import { useState } from "react";
import { Composer } from "@/components/composer/Composer";
import { EmptyState } from "@/components/chat/EmptyState";
import { Suggestions } from "@/components/chat/Suggestions";
import { Thread } from "@/components/chat/Thread";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import type { ChatMessage } from "@/lib/types";

let idCounter = 0;
const nextId = () => `m${++idCounter}`;

export default function Page() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const isEmpty = messages.length === 0;

  function send(text: string) {
    const user: ChatMessage = { id: nextId(), role: "user", content: text };
    const reply: ChatMessage = {
      id: nextId(),
      role: "assistant",
      content: `This is a UI-only clone — wire a model in here. You said: ${text}`,
    };
    setMessages((prev) => [...prev, user, reply]);
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-canvas">
      <div
        className="h-full shrink-0 overflow-hidden transition-[width] duration-200 ease-out"
        style={{ width: sidebarOpen ? "var(--sidebar-w)" : "0px" }}
      >
        <Sidebar
          onCollapse={() => setSidebarOpen(false)}
          onNewChat={() => setMessages([])}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </div>

      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar
          sidebarOpen={sidebarOpen}
          onOpenSidebar={() => setSidebarOpen(true)}
          onNewChat={() => setMessages([])}
        />

        {isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 pb-24">
            <EmptyState />
            <div className="w-full max-w-thread">
              <Composer onSend={send} />
            </div>
            <div className="w-full">
              <Suggestions />
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              <Thread messages={messages} />
            </div>
            <div className="px-4 pb-4">
              <Composer onSend={send} />
            </div>
          </>
        )}
      </main>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
