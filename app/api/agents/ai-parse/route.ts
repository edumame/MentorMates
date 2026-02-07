import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import {
  BUILT_IN_VOICE_OPTIONS,
  BUILT_IN_VOICE_PROMPT_OPTIONS,
  BUILT_IN_VOICE_VALUE_SET,
  type BuiltInVoiceValue,
} from "@/modules/agents/constants/voices";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : (null as unknown as OpenAI);

const STANDARD_TYPES = ["brainstorm", "product", "tech", "judge"] as const;
const BUILT_IN_VOICE_SET = BUILT_IN_VOICE_VALUE_SET;
const CUSTOM_VOICE_ID_REGEX = /^voice_[a-zA-Z0-9_-]+$/;
const BUILT_IN_VOICE_DESCRIPTION_LIST = BUILT_IN_VOICE_OPTIONS
  .map((voice) => `- ${voice.value}: ${voice.description}`)
  .join("\n");

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

  if (["technical", "developer", "engineer", "coding", "code"].includes(lower)) {
    return "tech";
  }
  if (["product manager", "pm", "strategy", "roadmap"].includes(lower)) {
    return "product";
  }
  if (["evaluation", "evaluator", "review", "scoring", "grader"].includes(lower)) {
    return "judge";
  }
  if (["ideation", "creative", "brainstorming"].includes(lower)) {
    return "brainstorm";
  }

  return value;
}

function normalizeVoice(input?: string): string | undefined {
  const value = cleanOptional(input);
  if (!value) return undefined;

  const lower = value.toLowerCase();
  if (BUILT_IN_VOICE_SET.has(lower as BuiltInVoiceValue)) {
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

function detectTypeFromText(text: string): string | undefined {
  const lower = text.toLowerCase();

  if (/\bjudge|score|scoring|evaluate|evaluation|rubric|review\b/.test(lower)) {
    return "judge";
  }
  if (/\btech|technical|engineer|developer|coding|code\b/.test(lower)) {
    return "tech";
  }
  if (/\bproduct|roadmap|strategy|go[- ]to[- ]market|pm\b/.test(lower)) {
    return "product";
  }
  if (/\bbrainstorm|ideate|ideation|creative\b/.test(lower)) {
    return "brainstorm";
  }

  return undefined;
}

function detectVoiceFromText(text: string): string | undefined {
  const explicitVoice = BUILT_IN_VOICE_OPTIONS.find((voice) =>
    new RegExp(`\\b${voice.value}\\b`, "i").test(text) ||
    new RegExp(`\\b${voice.label}\\b`, "i").test(text)
  );
  if (explicitVoice) return explicitVoice.value;

  const lower = text.toLowerCase();

  const descriptorMatch = [
    { voice: "fable", pattern: /\banother plain male\b|\balternate plain male\b/ },
    { voice: "ballad", pattern: /\bbritish\b|\buk accent\b|\bengland\b/ },
    { voice: "cedar", pattern: /\baudiobook\b|\bnarrator\b|\bvoiceover\b/ },
    { voice: "coral", pattern: /\benergetic\b|\blively\b|\bupbeat\b/ },
    { voice: "marin", pattern: /\bsunny\b|\bbright\b|\bcheerful\b/ },
    { voice: "nova", pattern: /\bcrisp\b|\bclean\b|\bclear\b/ },
    { voice: "onyx", pattern: /\bsteady\b|\bdeep\b|\bgrounded\b|\bauthoritative\b/ },
    { voice: "sage", pattern: /\bgentle\b|\bsupportive\b|\bpatient\b|\bcalm\b/ },
    { voice: "shimmer", pattern: /\bsoft\b|\bsoothing\b|\blight\b/ },
    { voice: "alloy", pattern: /\bplain female\b|\bneutral female\b/ },
    { voice: "ash", pattern: /\bplain male\b|\bneutral male\b/ },
  ] as const satisfies Array<{ voice: BuiltInVoiceValue; pattern: RegExp }>;

  const matchedDescriptor = descriptorMatch.find((candidate) =>
    candidate.pattern.test(lower)
  );
  if (matchedDescriptor) {
    return matchedDescriptor.voice;
  }

  if (/\bjudge\b|\bevaluate\b|\bevaluation\b|\brubric\b|\banalytical\b|\btechnical\b/.test(lower)) {
    return "onyx";
  }
  if (/\bmentor\b|\bcoaching\b|\bcoach\b|\bempathetic\b/.test(lower)) {
    return "sage";
  }
  if (/\bcreative\b|\bbrainstorm\b|\bideation\b/.test(lower)) {
    return "coral";
  }

  return undefined;
}

function ensureTypeAndVoice(input: ParsedAgent, text: string, mode: "fill" | "generate"): ParsedAgent {
  const ensured: ParsedAgent = { ...input };

  if (!ensured.type) {
    ensured.type = detectTypeFromText(text) ?? (mode === "generate" ? "brainstorm" : undefined);
  }

  if (!ensured.voice) {
    ensured.voice = detectVoiceFromText(text) ?? (mode === "generate" ? "alloy" : undefined);
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
  const typeMatch = /(?:^|\n)(?:agent\s*type|type|role)\s*[:\-]\s*(.+)$/im.exec(text);
  const feedbackPromptMatch =
    /(?:^|\n)(?:feedback\s*prompt|evaluation\s*prompt)\s*[:\-]\s*([\s\S]+)$/im.exec(text);
  const instructionsMatch =
    /(?:^|\n)(?:instructions?|system\s*prompt|prompt)\s*[:\-]\s*([\s\S]+)$/im.exec(text);
  const imageUrlMatch = /(https?:\/\/\S+\.(?:png|jpe?g|webp|gif))/i.exec(text);

  const voiceMatch = detectVoiceFromText(text);

  return {
    name: cleanOptional(nameMatch?.[1] || firstLine),
    type: cleanOptional(typeMatch?.[1]) || detectTypeFromText(text),
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
        warning: "OPENAI_API_KEY not configured. Used heuristic parsing.",
      });
    }

    const systemPromptFill = `You are an assistant that EXTRACTS agent setup fields from user-provided text.
Output STRICT JSON with only these optional fields when present:
{
  "name"?: string,
  "type"?: string,                 // Prefer brainstorm, product, tech, or judge. Custom is allowed.
  "instructions"?: string,         // Main system instructions for this agent
  "feedback_prompt"?: string,      // Optional rubric/evaluation prompt
  "avatar_url"?: string,           // Public image URL if explicitly provided
  "voice"?: string                 // One built-in voice (${BUILT_IN_VOICE_PROMPT_OPTIONS}) or a custom voice_* id
}
Built-in voice descriptions:
${BUILT_IN_VOICE_DESCRIPTION_LIST}
Rules:
- If a field is unknown, omit it.
- If type or voice is inferable from context, include them.
- Keep content practical and concise.
- Do NOT include code fences or commentary; JSON only.`;

    const systemPromptGenerate = `You are an assistant that GENERATES plausible agent setup fields from a short brief.
Produce a coherent agent identity and high-quality instructions aligned to the brief.
For generate mode, ALWAYS include "type" and "voice".
"type" must be one of: brainstorm, product, tech, judge.
"voice" should be one of: ${BUILT_IN_VOICE_PROMPT_OPTIONS}.
Voice descriptions:
${BUILT_IN_VOICE_DESCRIPTION_LIST}
Also generate clear "instructions" and (when relevant) a concrete "feedback_prompt".

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
      temperature: mode === "generate" ? 0.6 : 0.2,
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
