/**
 * POST /api/chat -- the shared AI participant's turn (T5, F3, F6).
 *
 * Called by the room client when a human turn @-summons the AI. Runs on the
 * Node runtime (streaming + the AI SDK need it), loads the whole room thread
 * from Postgres under the caller's RLS, builds speaker-labelled `messages` with
 * an aggressively cached prefix, and `streamText`s a Sonnet reply. Crucially the
 * token stream is NOT returned as SSE to this one requester -- it is relayed onto
 * the room's realtime Broadcast channel (F3) so every participant renders the
 * same live turn; the finished turn is persisted in `onFinish` and broadcast as a
 * normal message. Non-summoning calls are gated out here (double-gate; the client
 * only calls on summon, and non-summoning messages never reach the model).
 */
import { randomUUID } from "node:crypto";
import { streamText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildContext, type AuthorLabel } from "@/lib/ai/context";
import { chatModel } from "@/lib/ai/models";
import { openRoomRelay, persistAiMessage } from "@/lib/ai/relay";
import { isSummon } from "@/lib/ai/summon";
import { aiTools } from "@/lib/ai/tools";
import { getUser } from "@/lib/auth";
import { MESSAGE_COLUMNS, mapMessageRow, type MessageRow } from "@/lib/rooms";
import { createClient } from "@/lib/supabase/server";
import type { Message } from "@/lib/types";

export const runtime = "nodejs";

/** Minimum ms between relayed `delta` frames -- coalesces the token stream so a
 *  busy room isn't flooded with one broadcast per chunk (the final turn is
 *  delivered in full via `final` + the `end` frame regardless). */
const DELTA_THROTTLE_MS = 80;

const BodySchema = z.object({ roomId: z.string().uuid() });

interface MembershipRow {
  user_id: string;
  role: string;
}

export async function POST(req: Request): Promise<Response> {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  }
  const { roomId } = parsed.data;

  const supabase = createClient();

  // Load the whole thread under the caller's RLS: a non-member sees no rows
  // (fail-closed), so there is simply nothing to answer.
  const [messagesRes, membersRes, selfRes] = await Promise.all([
    supabase
      .from("messages")
      .select(MESSAGE_COLUMNS)
      .eq("room_id", roomId)
      .order("created_at", { ascending: true }),
    supabase.from("memberships").select("user_id, role").eq("group_id", roomId),
    supabase.from("users").select("name, email").eq("id", user.id).maybeSingle(),
  ]);

  const messages = ((messagesRes.data as MessageRow[] | null) ?? []).map(mapMessageRow);
  if (messages.length === 0) {
    return NextResponse.json({ skipped: "empty" }, { status: 200 });
  }

  // Double-gate: only fire the model when the newest human turn summons the AI.
  const lastHuman = [...messages].reverse().find((m) => m.senderKind === "human");
  if (!lastHuman || !isSummon(lastHuman.content)) {
    return NextResponse.json({ skipped: "not-summoned" }, { status: 200 });
  }

  // Speaker labels: role comes from `memberships` (RLS-readable to members); the
  // caller's own name from `users`. Co-members' names aren't RLS-readable, so
  // they fall back to a generic label (same honesty as the room loader).
  const selfName = selfRes.data?.name ?? selfRes.data?.email ?? user.email ?? "You";
  const authors: Record<string, AuthorLabel> = {};
  for (const m of (membersRes.data as MembershipRow[] | null) ?? []) {
    authors[m.user_id] = { name: m.user_id === user.id ? selfName : "Member", role: m.role };
  }

  const { system, messages: modelMessages } = buildContext(messages, {
    authors,
    fallback: { name: "Member", role: "member" },
  });

  // One stable id for the whole turn: streamed frames and the persisted row share
  // it, so clients dedupe cleanly (streaming buffer -> final message, same id).
  const messageId = randomUUID();
  const createdAt = new Date().toISOString();
  const draft = (content: string): Message => ({
    id: messageId,
    roomId,
    senderId: "",
    senderKind: "ai",
    kind: "chat",
    content,
    attachments: [],
    createdAt,
  });

  const relay = openRoomRelay(roomId);
  await relay.frame("start", draft(""));

  // onFinish (SDK callback) persists + publishes the final turn; resolve `done`
  // so we only tear the relay down once persistence has run.
  let resolveDone: () => void = () => {};
  const done = new Promise<void>((r) => {
    resolveDone = r;
  });

  const result = streamText({
    model: chatModel,
    system,
    messages: modelMessages,
    tools: aiTools,
    onFinish: async ({ text }) => {
      try {
        const finalText = text.trim();
        if (finalText.length > 0) {
          const stored = await persistAiMessage(roomId, messageId, finalText);
          if (stored) await relay.final(stored);
        }
      } finally {
        await relay.frame("end", draft(text));
        resolveDone();
      }
    },
  });

  // Drive the stream server-side, relaying (throttled) deltas onto the room
  // channel. We never return this stream to the requester (F3).
  let accumulated = "";
  let lastAt = 0;
  for await (const delta of result.textStream) {
    accumulated += delta;
    const now = Date.now();
    if (now - lastAt >= DELTA_THROTTLE_MS) {
      lastAt = now;
      await relay.frame("delta", draft(accumulated));
    }
  }

  await done;
  await relay.close();
  return NextResponse.json({ messageId }, { status: 200 });
}
