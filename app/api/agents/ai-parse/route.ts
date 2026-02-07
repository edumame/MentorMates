import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { createSupabaseClient } from "@/app/utils/supabase/server";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : (null as unknown as OpenAI);
const AGENT_PARSE_MODEL =
  (process.env.OPENAI_AGENT_PARSE_MODEL || "").trim() || "gpt-5.2";

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

function extractStringField(json: unknown, fieldName: string): string | undefined {
  if (!json || typeof json !== "object") return undefined;
  const record = json as Record<string, unknown>;
  const raw = record[fieldName];
  return typeof raw === "string" ? cleanOptional(raw) : undefined;
}

async function rewriteUserPersonaInstructions(params: {
  brief: string;
  draftInstructions: string;
}): Promise<string | undefined> {
  const rewriteSystem = `You rewrite an agent instruction prompt for a synthetic user persona.
Return STRICT JSON only:
{
  "instructions": string
}

Requirements for "instructions":
- Keep markdown formatting.
- Write as a concrete persona, not generic guidance.
- Include a realistic full name and location (use location from the brief when provided).
- If childcare/young-children context is present, include one concrete child profile (name + age) and practical constraints.
- Include 6-8 specific bullet points about the persona's habits, sensitivities, and constraints.
- Include a "When giving feedback" section with concrete evaluation lens and real-world constraints.
- Include "Structure your response as" with numbered sections 1, 2, 3.
- Keep tone warm, honest, and practical.
- Avoid technical jargon if the brief implies a non-technical audience.
- Target ~220-420 words.
- Do not mention being an AI or an assistant.`;

  const rewriteUser = `Original brief:
${params.brief}

Current draft instructions:
${params.draftInstructions}`;

  const completion = await openai.chat.completions.create({
    model: AGENT_PARSE_MODEL,
    messages: [
      { role: "system", content: rewriteSystem },
      { role: "user", content: rewriteUser },
    ],
    temperature: 0.2,
    max_tokens: 800,
  });

  const content = completion.choices?.[0]?.message?.content || "";
  const json = extractJsonFromText(content);
  return extractStringField(json, "instructions");
}

async function generateContextualFeedbackPrompt(params: {
  brief: string;
  type?: string;
  instructions?: string;
  draftFeedbackPrompt?: string;
}): Promise<string | undefined> {
  const feedbackSystem = `You generate a system-level feedback prompt used to evaluate a completed conversation transcript.
Return STRICT JSON only:
{
  "feedback_prompt": string
}

Intent:
- The evaluator uses a neutral third-person perspective to review the conversation and give actionable coaching to the user who spoke.
- The feedback must be context-specific to the scenario in the brief/instructions.

Requirements for "feedback_prompt":
- Tell the evaluator to ground observations in specific moments from the transcript (avoid generic advice).
- Focus on practical improvement, not praise-only output.
- Instruct output with these sections in order:
  1. Conversation Summary
  2. What You Did Well
  3. Improvement Opportunities
  4. Next Actions
  5. Questions To Explore Next
- Keep tone direct, supportive, and practical.
- If scenario is pitching/public speaking, prioritize message clarity, audience fit, storytelling, objections, and close.
- If scenario is coding/technical problem solving, prioritize problem framing, decomposition, tradeoffs, debugging quality, and next prompt sequence.
- If scenario is user/persona practice, prioritize empathy, discovery depth, assumptions, risk/safety concerns, and actionability.
- Include concise, concrete next steps and suggested practice prompts.
- Avoid requiring numeric scoring unless explicitly requested by the scenario.
- Keep it concise (roughly 140-260 words).`;

  const feedbackUser = `Scenario brief:
${params.brief}

Agent type:
${params.type || "(not specified)"}

Agent instructions:
${params.instructions || "(not provided)"}

Current feedback prompt draft:
${params.draftFeedbackPrompt || "(none)"}`;

  const completion = await openai.chat.completions.create({
    model: AGENT_PARSE_MODEL,
    messages: [
      { role: "system", content: feedbackSystem },
      { role: "user", content: feedbackUser },
    ],
    temperature: 0.2,
    max_tokens: 600,
  });

  const content = completion.choices?.[0]?.message?.content || "";
  const json = extractJsonFromText(content);
  return extractStringField(json, "feedback_prompt");
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

function buildFallbackFeedbackPrompt(params: { type?: string; brief: string }): string {
  const focusByType: Record<string, string> = {
    judge: "evaluation clarity, evidence quality, decision rationale, and recommendation quality",
    tech: "problem framing, technical decomposition, tradeoffs, debugging quality, and implementation next steps",
    product: "user problem clarity, prioritization logic, value proposition, and execution sequencing",
    user: "empathy, discovery depth, assumption quality, risk/safety awareness, and practical actionability",
    brainstorm: "option quality, creativity, feasibility, and decision focus",
  };

  const focus = focusByType[params.type || ""] || "clarity, specificity, and actionable communication";

  return `You are a neutral third-person conversation evaluator. Review the completed transcript and provide coaching to the user based on this scenario brief: "${params.brief}".

Focus on: ${focus}.

Ground feedback in specific moments from the transcript. Avoid generic advice.

Output exactly these sections:
1. Conversation Summary
2. What You Did Well
3. Improvement Opportunities
4. Next Actions
5. Questions To Explore Next

Keep feedback practical, specific, and supportive. Do not use numeric scoring unless explicitly requested in the scenario.`;
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
- Prefer explicit values from labeled lines (for example: "Type:", "Voice:", "Instructions:", "Feedback Prompt:").
- Keep content practical and concise.
- Do NOT include code fences or commentary; JSON only.`;

    const systemPromptGenerate = `You GENERATE complete agent setup fields from a short brief.
Return STRICT JSON only:
{
  "name": string,
  "type": "brainstorm" | "product" | "tech" | "judge" | "user",
  "instructions": string,
  "voice": "alloy" | "ash" | "ballad" | "cedar" | "coral" | "echo" | "marin" | "sage" | "shimmer" | "verse",
  "feedback_prompt": string,
  "avatar_url"?: string
}

Type selection rules:
- "user": simulated end-user persona with lived perspective (for example parent, customer, teacher, student, caregiver, patient).
- "judge": formal evaluator with rubric/scoring/ratings.
- "tech": technical mentor/engineering advisor.
- "product": product/strategy/go-to-market advisor.
- "brainstorm": ideation/creative exploration.
- If brief includes both persona + feedback, choose "user" unless formal scoring/judging is explicitly requested.

Instructions quality bar:
- Convert the brief into a ready-to-use system prompt, not a summary.
- Be concrete and specific. Avoid vague language.
- Include response structure as numbered sections.
- Keep language matched to audience; avoid technical jargon for non-technical personas.

Feedback prompt quality bar:
- Must define how a neutral third-person evaluator should review a completed transcript and coach the user.
- Must be context-specific to the scenario (pitching, coding, user interview/persona, etc.).
- Must require concrete strengths, concrete improvement opportunities, and clear next steps.

For type "user", instructions MUST include:
- Persona identity with realistic full name and location.
- Concrete context details (for example relationship, responsibilities, and environment).
- 6-8 bullet points describing habits, sensitivities, and practical constraints.
- A "When giving feedback" section with specific criteria and real-world concerns.
- A "Structure your response as" section with numbered 1, 2, 3.
- Warm, honest, practical tone.

Do not invent avatar URLs unless a URL is provided in the input.
Do NOT include code fences or commentary; JSON only.`;

    const system =
      mode === "generate"
        ? systemPromptGenerate
        : systemPromptFill;

    let content = "";
    try {
      const completion = await openai.chat.completions.create({
        model: AGENT_PARSE_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: text },
        ],
        temperature: mode === "generate" ? 0.3 : 0.2,
        max_tokens: 700,
      });
      content = completion.choices?.[0]?.message?.content || "";
    } catch (modelError) {
      // eslint-disable-next-line no-console
      console.warn("Primary OpenAI generation failed; using fallback parsing.", modelError);

      let fallbackFields = normalizeAgentFields(
        ensureTypeAndVoice(heuristicParse(text), text, mode)
      );

      if (mode === "generate" && !fallbackFields.feedback_prompt) {
        fallbackFields = {
          ...fallbackFields,
          feedback_prompt: buildFallbackFeedbackPrompt({
            type: fallbackFields.type,
            brief: text,
          }),
        };
      }

      return NextResponse.json({
        fields: fallbackFields,
        warning: "OpenAI generation failed. Used fallback parsing.",
      });
    }

    const json = extractJsonFromText(content);
    if (!json) {
      let fallbackFields = normalizeAgentFields(
        ensureTypeAndVoice(heuristicParse(text), text, mode)
      );
      if (mode === "generate" && !fallbackFields.feedback_prompt) {
        fallbackFields = {
          ...fallbackFields,
          feedback_prompt: buildFallbackFeedbackPrompt({
            type: fallbackFields.type,
            brief: text,
          }),
        };
      }
      return NextResponse.json({
        fields: fallbackFields,
        warning: "AI output was not valid JSON. Used fallback parsing.",
      });
    }

    const validated = ParsedAgentSchema.safeParse(json);
    if (!validated.success) {
      let fallbackFields = normalizeAgentFields(
        ensureTypeAndVoice(heuristicParse(text), text, mode)
      );
      if (mode === "generate" && !fallbackFields.feedback_prompt) {
        fallbackFields = {
          ...fallbackFields,
          feedback_prompt: buildFallbackFeedbackPrompt({
            type: fallbackFields.type,
            brief: text,
          }),
        };
      }
      return NextResponse.json({
        fields: fallbackFields,
        warning: "AI output schema mismatch. Used fallback parsing.",
      });
    }

    let fields = normalizeAgentFields(
      ensureTypeAndVoice(normalizeAgentFields(validated.data), text, mode)
    );

    if (mode === "generate" && fields.type === "user" && fields.instructions) {
      try {
        const rewritten = await rewriteUserPersonaInstructions({
          brief: text,
          draftInstructions: fields.instructions,
        });
        if (rewritten) {
          fields = { ...fields, instructions: rewritten };
        }
      } catch (rewriteError) {
        // eslint-disable-next-line no-console
        console.warn("Failed to rewrite user persona instructions", rewriteError);
      }
    }

    if (mode === "generate") {
      try {
        const rewrittenFeedbackPrompt = await generateContextualFeedbackPrompt({
          brief: text,
          type: fields.type,
          instructions: fields.instructions,
          draftFeedbackPrompt: fields.feedback_prompt,
        });
        if (rewrittenFeedbackPrompt) {
          fields = { ...fields, feedback_prompt: rewrittenFeedbackPrompt };
        }
      } catch (feedbackError) {
        // eslint-disable-next-line no-console
        console.warn("Failed to generate contextual feedback prompt", feedbackError);
      }

      if (!fields.feedback_prompt) {
        fields = {
          ...fields,
          feedback_prompt: buildFallbackFeedbackPrompt({ type: fields.type, brief: text }),
        };
      }
    }

    return NextResponse.json({ fields });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/agents/ai-parse:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
