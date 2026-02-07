import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { createSupabaseClient } from "@/app/utils/supabase/server";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : (null as unknown as OpenAI);

const STANDARD_TYPES = ["brainstorm", "product", "tech", "judge", "user"] as const;
const BUILT_IN_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "cedar",
  "coral",
  "echo",
  "marin",
  "sage",
  "shimmer",
  "verse",
] as const;
type BuiltInVoice = (typeof BUILT_IN_VOICES)[number];
const BUILT_IN_VOICE_SET = new Set(BUILT_IN_VOICES);
const CUSTOM_VOICE_ID_REGEX = /^voice_[a-zA-Z0-9_-]+$/;
const LEGACY_VOICE_ALIAS_MAP: Record<string, BuiltInVoice> = {
  fable: "verse",
  nova: "coral",
  onyx: "cedar",
};

const RequestSchema = z.object({
  text: z.string().min(1),
  mode: z.enum(["fill", "generate"]).optional().default("fill"),
});

const ParsedAgentSchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  instructions: z.string().optional(),
  feedback_prompt: z.string().optional(),
  avatar_url: z.string().url().optional(),
  voice: z.string().optional(),
});

type ParsedAgent = z.infer<typeof ParsedAgentSchema>;

function cleanOptional(value?: string): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeType(input?: string): string | undefined {
  const value = cleanOptional(input);
  if (!value) return undefined;

  const lower = value.toLowerCase();
  if (STANDARD_TYPES.includes(lower as (typeof STANDARD_TYPES)[number])) {
    return lower;
  }

  return value;
}

function normalizeVoice(input?: string): string | undefined {
  const value = cleanOptional(input);
  if (!value) return undefined;

  const lower = value.toLowerCase();
  const alias = LEGACY_VOICE_ALIAS_MAP[lower];
  if (alias) {
    return alias;
  }
  if (BUILT_IN_VOICE_SET.has(lower as (typeof BUILT_IN_VOICES)[number])) {
    return lower;
  }
  if (CUSTOM_VOICE_ID_REGEX.test(value)) {
    return value;
  }
  if (CUSTOM_VOICE_ID_REGEX.test(lower)) {
    return lower;
  }

  return undefined;
}

function extractLabeledValue(text: string, labelPattern: string): string | undefined {
  const match = new RegExp(`(?:^|\\n)\\s*(?:${labelPattern})\\s*[:\\-]\\s*([^\\n]+)`, "im").exec(text);
  return cleanOptional(match?.[1]);
}

function extractExplicitType(text: string): string | undefined {
  const labeledType = extractLabeledValue(text, "agent\\s*type|type|role");
  const normalizedLabeledType = normalizeType(labeledType);
  if (normalizedLabeledType) return normalizedLabeledType;

  const explicitStandardType = new RegExp(`\\b(?:${STANDARD_TYPES.join("|")})\\b`, "i").exec(text)?.[0];
  return normalizeType(explicitStandardType);
}

function extractExplicitVoice(text: string): string | undefined {
  const labeledVoice = extractLabeledValue(text, "voice");
  const normalizedLabeledVoice = normalizeVoice(labeledVoice);
  if (normalizedLabeledVoice) return normalizedLabeledVoice;

  const explicitCustomVoice = text.match(/\bvoice_[a-zA-Z0-9_-]+\b/i)?.[0];
  const normalizedCustomVoice = normalizeVoice(explicitCustomVoice);
  if (normalizedCustomVoice) return normalizedCustomVoice;

  const explicitVoiceNames = [...BUILT_IN_VOICES, ...Object.keys(LEGACY_VOICE_ALIAS_MAP)];
  const explicitNamedVoice = new RegExp(`\\b(?:${explicitVoiceNames.join("|")})\\b`, "i").exec(text)?.[0];
  return normalizeVoice(explicitNamedVoice);
}

function defaultVoiceForType(type: string | undefined): BuiltInVoice {
  switch (type) {
    case "judge":
      return "alloy";
    case "tech":
      return "ash";
    case "product":
      return "marin";
    case "user":
      return "echo";
    case "brainstorm":
    default:
      return "shimmer";
  }
}

function ensureTypeAndVoice(input: ParsedAgent, text: string, mode: "fill" | "generate"): ParsedAgent {
  const ensured: ParsedAgent = { ...input };

  const normalizedType = normalizeType(ensured.type);
  const explicitTypeFromText = extractExplicitType(text);
  if (normalizedType) {
    ensured.type = normalizedType;
  } else if (explicitTypeFromText) {
    ensured.type = explicitTypeFromText;
  } else {
    ensured.type = mode === "generate" ? "brainstorm" : undefined;
  }

  const normalizedVoice = normalizeVoice(ensured.voice);
  const explicitVoiceFromText = extractExplicitVoice(text);
  if (normalizedVoice) {
    ensured.voice = normalizedVoice;
  } else if (explicitVoiceFromText) {
    ensured.voice = explicitVoiceFromText;
  } else if (mode === "generate") {
    ensured.voice = defaultVoiceForType(ensured.type);
  } else {
    ensured.voice = undefined;
  }

  return ensured;
}

function heuristicParse(text: string): ParsedAgent {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const firstLine = lines[0] && lines[0].length <= 120 ? lines[0] : undefined;
  const nameMatch = /(?:^|\n)(?:agent\s*name|name|title)\s*[:\-]\s*(.+)$/im.exec(text);
  const feedbackPromptMatch =
    /(?:^|\n)(?:feedback\s*prompt|evaluation\s*prompt)\s*[:\-]\s*([\s\S]+)$/im.exec(text);
  const instructionsMatch =
    /(?:^|\n)(?:instructions?|system\s*prompt|prompt)\s*[:\-]\s*([\s\S]+)$/im.exec(text);
  const imageUrlMatch = /(https?:\/\/\S+\.(?:png|jpe?g|webp|gif))/i.exec(text);

  const typeMatch = extractExplicitType(text);
  const voiceMatch = extractExplicitVoice(text);

  return {
    name: cleanOptional(nameMatch?.[1] || firstLine),
    type: typeMatch,
    instructions: cleanOptional(instructionsMatch?.[1]) || cleanOptional(text),
    feedback_prompt: cleanOptional(feedbackPromptMatch?.[1]),
    avatar_url: cleanOptional(imageUrlMatch?.[1]),
    voice: voiceMatch,
  };
}

function extractJsonFromText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      const maybeJson = text.slice(start, end + 1);
      try {
        return JSON.parse(maybeJson);
      } catch {
        // ignore
      }
    }
  }
  return null;
}

function normalizeAgentFields(input: ParsedAgent): ParsedAgent {
  const normalized: ParsedAgent = {};

  const name = cleanOptional(input.name);
  const instructions = cleanOptional(input.instructions);
  const feedbackPrompt = cleanOptional(input.feedback_prompt);
  const avatarUrl = cleanOptional(input.avatar_url);
  const type = normalizeType(input.type);
  const voice = normalizeVoice(input.voice);

  if (name) normalized.name = name;
  if (type) normalized.type = type;
  if (instructions) normalized.instructions = instructions;
  if (feedbackPrompt) normalized.feedback_prompt = feedbackPrompt;
  if (avatarUrl) normalized.avatar_url = avatarUrl;
  if (voice) normalized.voice = voice;

  return normalized;
}

export async function POST(req: Request) {
  const supabase = await createSupabaseClient();

  try {
    const body = await req.json();
    const parsedReq = RequestSchema.safeParse(body);
    if (!parsedReq.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsedReq.error.flatten() },
        { status: 400 }
      );
    }

    const { text, mode } = parsedReq.data;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.OPENAI_API_KEY) {
      const fields = normalizeAgentFields(
        ensureTypeAndVoice(heuristicParse(text), text, mode)
      );
      return NextResponse.json({
        fields,
        warning: "OPENAI_API_KEY not configured. Used explicit field parsing and defaults.",
      });
    }

    const systemPromptFill = `You are an assistant that EXTRACTS agent setup fields from user-provided text.
Output STRICT JSON with only these optional fields when present:
{
  "name"?: string,
  "type"?: string,                 // Prefer brainstorm, product, tech, judge, or user. Custom is allowed.
  "instructions"?: string,         // Main system instructions for this agent
  "feedback_prompt"?: string,      // Optional rubric/evaluation prompt
  "avatar_url"?: string,           // Public image URL if explicitly provided
  "voice"?: string                 // One of: alloy, ash, ballad, cedar, coral, echo, marin, sage, shimmer, verse, or a custom voice_* id
}
Rules:
- If a field is unknown, omit it.
- If type or voice is inferable from context, include them.
- Keep content practical and concise.
- Do NOT include code fences or commentary; JSON only.`;

    const systemPromptGenerate = `You are an assistant that GENERATES plausible agent setup fields from a short brief.
Produce a coherent agent identity and high-quality instructions aligned to the brief.
For generate mode, ALWAYS include "name", "type", "voice", and "instructions".
"type" must be one of: brainstorm, product, tech, judge, user.
"voice" should be one of: alloy, ash, ballad, cedar, coral, echo, marin, sage, shimmer, verse.
Also generate a concrete "feedback_prompt" when evaluation/scoring is relevant.

If the brief asks to simulate a real end-user/persona (for example parent, customer, teacher, student, caregiver), prefer type "user".

Quality bar for "instructions":
- Convert the brief into a ready-to-use system prompt, not a short summary.
- Be specific, concrete, and contextual. If the brief implies a persona, include specific identity details (name, location, responsibilities, audience details, and constraints).
- Avoid vague wording like "give helpful feedback"; define exactly what to look for and how to respond.
- Include response structure as numbered sections.
- Keep language aligned to the requested audience (for example: no technical jargon if the brief asks for plain language).
- Target roughly 140-260 words unless the user input is already more detailed.
- If the brief references young children or caregivers, include practical safety and attention-span constraints (e.g., supervision, durability, cleanup, sensory overload, and frustration points).

Concrete examples:
- Good instructions example: "Start by asking up to 2 clarifying questions, then provide 3 ranked options with tradeoffs and a recommended next step."
- Good feedback_prompt example: "Evaluate the submission on feasibility, technical depth, and user impact (1-10 each), then return 3 actionable improvements."

Do not invent avatar URLs unless a URL is provided in the input.`;

    const system =
      mode === "generate"
        ? `${systemPromptFill}\n\n${systemPromptGenerate}`
        : systemPromptFill;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: text },
      ],
      temperature: mode === "generate" ? 0.3 : 0.2,
      max_tokens: 700,
    });

    const content = completion.choices?.[0]?.message?.content || "";
    const json = extractJsonFromText(content);
    if (!json) {
      return NextResponse.json(
        { error: "Failed to parse AI output", raw: content },
        { status: 502 }
      );
    }

    const validated = ParsedAgentSchema.safeParse(json);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Invalid AI output", details: validated.error.flatten(), raw: content },
        { status: 502 }
      );
    }

    const fields = normalizeAgentFields(
      ensureTypeAndVoice(normalizeAgentFields(validated.data), text, mode)
    );
    return NextResponse.json({ fields });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/agents/ai-parse:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
