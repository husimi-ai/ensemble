/**
 * Opus-drafted work-guide generation (T5). A work-guide is a structured plan of
 * concrete next steps for the room, drafted from the discussion so far. Unlike
 * deep research this is a single bounded synthesis, so it runs inline (AI SDK
 * `generateText` on the Opus tier -- the same heavy-drafting model the research
 * synthesis + paper drafting use) rather than in the background worker.
 *
 * The finished guide is posted back as an `ai` message (`kind: "work_guide"`)
 * via the shared artifact poster (service-role insert + room broadcast, F3).
 *
 * Server-only: reads the room under the caller's RLS + the server Anthropic key.
 * Never import from client code.
 */
import { generateText } from "ai";
import { buildContext } from "@/lib/ai/context";
import { draftModel } from "@/lib/ai/models";
import { postAiArtifact } from "@/lib/jobs";
import { MESSAGE_COLUMNS, mapMessageRow, type MessageRow } from "@/lib/rooms";
import { createClient } from "@/lib/supabase/server";
import type { Message } from "@/lib/types";

/** Frozen work-guide drafting instructions (Opus system prompt). */
const WORKGUIDE_SYSTEM = [
  "You are Ensemble, drafting a work-guide for a multi-person research room.",
  "A work-guide is a concise, structured plan of concrete next steps the team",
  "can act on. Ground it strictly in the room's discussion so far. Use short",
  "Markdown sections: an Objective line, then ordered Steps (each with an owner",
  "role and a definition of done), Risks/open questions, and Suggested tools or",
  "data. Be specific and actionable; do not invent facts the room hasn't raised.",
].join(" ");

/** Result of a work-guide draft. */
export type WorkGuideResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

/**
 * Draft a work-guide for `roomId` focused on `focus`, post it to the room, and
 * return the persisted message id. Loads the thread under the caller's RLS (a
 * non-member sees no rows -> nothing to draft).
 */
export async function draftWorkGuide(
  roomId: string,
  focus: string,
): Promise<WorkGuideResult> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });
  if (error) return { ok: false, error: error.message };

  const thread = ((data as MessageRow[] | null) ?? []).map(mapMessageRow);
  if (thread.length === 0) return { ok: false, error: "empty room" };

  const { messages } = buildContext(thread, {
    fallback: { name: "Member", role: "member" },
  });
  messages.push({
    role: "user",
    content: `[work-guide request]: Draft a work-guide covering: ${focus}`,
  });

  let text: string;
  try {
    const result = await generateText({
      model: draftModel,
      system: WORKGUIDE_SYSTEM,
      messages,
    });
    text = result.text.trim();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "draft failed" };
  }
  if (text.length === 0) return { ok: false, error: "empty draft" };

  const posted: Message | null = await postAiArtifact({
    roomId,
    kind: "work_guide",
    content: text,
  });
  if (!posted) return { ok: false, error: "failed to post work-guide" };
  return { ok: true, messageId: posted.id };
}
