/**
 * AI Chat processing logic for the event builder assistant.
 * Ported from event-scraper with submission context support.
 */

export type EventLike = Record<string, unknown>;

export type ChatContext = "submission";

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export interface AIChatResult {
  reply: string;
  patch: Partial<EventLike> | null;
}

const RESPONSE_FORMAT = `Respond with STRICT JSON in this shape:
{
  "reply": "<friendly confirmation message>",
  "patch": { <partial EventData fields to merge> }
}

If the user is just chatting or asking a question (not requesting a change), respond with:
{
  "reply": "<helpful answer>",
  "patch": null
}

Rules:
- Only include fields in "patch" that the user wants changed. Omit unchanged fields.
- Keep replies concise and friendly.
- Output ONLY valid JSON. No code fences, no commentary outside the JSON.`;

export const SUBMISSION_PROMPT = `You are an AI assistant that helps organizers configure their hackathon submission form. You manage the fields participants will fill out when submitting projects.

${RESPONSE_FORMAT}

Available EventData fields you can patch:
- submission_fields: Array of field objects (ALWAYS include the FULL array when editing):
  Each field: {
    id: string (unique identifier, use lowercase_snake_case like "tech_stack"),
    label: string (display label),
    type: "text" | "textarea" | "url" | "file" | "select" | "multi_select" | "checkbox",
    required: boolean,
    placeholder: string (hint text),
    helperText?: string (shown below the field),
    options?: string[] (required for "select" and "multi_select" types),
    multiple?: boolean (for "url" and "file" — allows multiple entries),
    maxFiles?: number (for "file" type when multiple=true)
  }

IMPORTANT:
- The first two fields (id: "project_name" and "project_description") are LOCKED and must ALWAYS be included unchanged at the start of the array.
- When adding a field, append it to the existing array. When removing, filter it out.
- Always return the FULL submission_fields array in the patch, not just the changed field.
- Generate sensible IDs using lowercase_snake_case (e.g., "tech_stack", "demo_video", "project_categories").`;

export function getSystemPrompt(_context: ChatContext | string): string {
  return SUBMISSION_PROMPT;
}

export function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        // ignore
      }
    }
  }
  return null;
}

export function parseAIResponse(raw: string): AIChatResult {
  const json = extractJson(raw) as Record<string, unknown> | null;
  if (!json || typeof json !== "object") {
    return { reply: raw.trim() || "Sorry, I couldn't process that.", patch: null };
  }

  const reply =
    typeof json.reply === "string" ? json.reply : "Done!";
  const patch =
    json.patch && typeof json.patch === "object" && !Array.isArray(json.patch)
      ? (json.patch as Partial<EventLike>)
      : null;

  return { reply, patch };
}

export function buildMessages(
  event: EventLike,
  history: ChatMessage[],
  userMessage: string,
  context?: ChatContext | string
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const systemPrompt = getSystemPrompt(context ?? "submission");

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    {
      role: "system",
      content: `Current event state:\n${JSON.stringify(event, null, 2)}`,
    },
  ];

  const recentHistory = history.slice(-10);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.text,
    });
  }

  messages.push({ role: "user", content: userMessage });

  return messages;
}
