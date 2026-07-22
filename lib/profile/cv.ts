/**
 * LLM CV / resume parse -> structured profile JSON (T1). Server-only: uses the
 * Anthropic SDK with `ANTHROPIC_API_KEY`. Accepts pasted text or an uploaded
 * PDF (base64) and emits {@link CvExtraction} validated by the Zod schema via
 * structured outputs (`messages.parse` + `zodOutputFormat`).
 *
 * Medical = special category (Art. 9): the prompt extracts the person's
 * *research* profile only and is explicitly forbidden from extracting or
 * inferring the person's own health information.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { CvExtractionSchema, type CvExtraction } from "./schema";

/** Cheap, fast gate model for extraction (T1). */
const CV_MODEL = "claude-haiku-4-5";

const SYSTEM = [
  "You extract a researcher's professional profile from their CV or resume.",
  "Return ONLY the requested structured fields. For anything not present in the",
  "document, use null (scalars) or an empty array (lists) -- never invent facts.",
  "'resources' means research data or compute the person controls or curates",
  "(e.g. a cohort dataset, a biobank, a GPU cluster) described at the domain",
  "level. NEVER extract, infer, or record the person's own health, medical",
  "conditions, or any special-category personal data (GDPR Art. 9).",
].join(" ");

const INSTRUCTION =
  "Extract the structured research profile from the CV above.";

/** Missing key is a hard failure for CV parse (it genuinely needs the LLM). */
function anthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set (server-only CV parse)");
  }
  return new Anthropic();
}

/**
 * Parse a CV into structured profile fields. Provide `text` (pasted CV),
 * `pdfBase64` (uploaded PDF), or both. Throws if neither is given or if the
 * model returns no valid structured output.
 */
export async function parseCv(input: {
  text?: string;
  pdfBase64?: string;
}): Promise<CvExtraction> {
  if (!input.text && !input.pdfBase64) {
    throw new Error("parseCv requires `text` or `pdfBase64`");
  }
  const client = anthropicClient();

  const content: Anthropic.ContentBlockParam[] = [];
  if (input.pdfBase64) {
    content.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: input.pdfBase64 },
    });
  }
  if (input.text) content.push({ type: "text", text: input.text });
  content.push({ type: "text", text: INSTRUCTION });

  const message = await client.messages.parse({
    model: CV_MODEL,
    max_tokens: 4096,
    system: SYSTEM,
    messages: [{ role: "user", content }],
    output_config: { format: zodOutputFormat(CvExtractionSchema) },
  });

  if (!message.parsed_output) {
    throw new Error("CV parse returned no structured output");
  }
  return message.parsed_output;
}
