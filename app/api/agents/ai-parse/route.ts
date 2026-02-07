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

const ParsedAgentSchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  instructions: z.string().optional(),
  feedback_prompt: z.string().optional(),
  avatar_url: z.string().url().optional(),
  voice: z.string().optional(),
});

type ParsedAgent = z.infer<typeof ParsedAgentSchema>;
const GenerationStepSchema = z.enum(["all", "instruction", "feedback_prompt", "metadata"]);
type GenerationStep = z.infer<typeof GenerationStepSchema>;
type GenerateStage = Exclude<GenerationStep, "all">;

const RequestSchema = z.object({
  text: z.string().min(1),
  mode: z.enum(["fill", "generate"]).optional().default("fill"),
  step: GenerationStepSchema.optional().default("all"),
  context: ParsedAgentSchema.optional().default({}),
});

const GENERATION_STAGE_ORDER: GenerateStage[] = [
  "instruction",
  "feedback_prompt",
  "metadata",
];

type AiOutputError = {
  kind: "ai-output";
  message: string;
  raw?: string;
  details?: unknown;
  stage?: GenerationStep;
};

function isAiOutputError(error: unknown): error is AiOutputError {
  return (
    typeof error === "object" &&
    error !== null &&
    "kind" in error &&
    (error as { kind?: unknown }).kind === "ai-output"
  );
}

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

function ensureTypeAndVoice(
  input: ParsedAgent,
  text: string,
  mode: "fill" | "generate",
  options?: { applyGenerateDefaults?: boolean }
): ParsedAgent {
  const ensured: ParsedAgent = { ...input };
  const applyGenerateDefaults = options?.applyGenerateDefaults ?? true;

  if (!ensured.type) {
    ensured.type =
      detectTypeFromText(text) ??
      (mode === "generate" && applyGenerateDefaults ? "brainstorm" : undefined);
  }

  if (!ensured.voice) {
    ensured.voice =
      detectVoiceFromText(text) ??
      (mode === "generate" && applyGenerateDefaults ? "alloy" : undefined);
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

function buildGenerateSystemPrompt(stage: GenerateStage): string {
  if (stage === "instruction") {
    return `You write production-quality system instructions for a custom agent based on a short user brief.
Return ONLY the final instruction text.

Quality requirements:
- Be concrete and specific, not generic.
- Include a named persona identity and preserve exact facts from the brief (location, age range, role).
- If the brief targets children or users, anchor feedback to one specific child/user profile with traits, behaviors, and practical constraints.
- Include a "When giving feedback" section with concrete details to inspect (safety, clarity, engagement, frustration triggers, sensory triggers, supervision, cleanup, durability, sharing).
- Include a required response structure with numbered sections 1, 2, 3.
- Use plain, human language for the stated role; avoid technical jargon unless explicitly requested.
- Avoid generic coaching filler like "be constructive" without specifics.
- Do NOT add numeric scoring rubrics unless the user explicitly asks for scoring.
- The output should be ready to paste directly into an agent Instructions field.

Do not return JSON.
Do not wrap in markdown code fences.
Do not add commentary before or after the instructions.`;
  }

  if (stage === "feedback_prompt") {
    return `Write a concise feedback-evaluation prompt that complements the agent instructions.
Return ONLY the feedback prompt text.

Rules:
- Align with the persona and priorities in the instructions.
- The feedback must evaluate the student's behavior in the conversation, not the agent's performance.
- Assume the agent is doing its best; do not score, criticize, or diagnose agent quality.
- Focus on student turns and decisions (clarifying questions, listening, adaptation, specificity, safety awareness, practical actionability).
- Use agent turns only as context for how the student responded.
- Ask for concrete observations and actionable coaching for the student.
- Require evidence from the transcript (specific quotes or turn references tied to student behavior).
- Keep it short and operational (about 4-8 sentences).
- Do NOT require numeric scoring unless the user explicitly asks for scoring.
- Do not repeat the full persona instructions.

Do not return JSON.
Do not wrap in markdown code fences.
Do not add commentary before or after the prompt.`;
  }

  return `Return STRICT JSON only:
{
  "name"?: string,
  "type"?: string,
  "voice"?: string,
  "avatar_url"?: string
}
Rules:
- Include "type" and "voice" whenever possible.
- "type" should prefer one of: brainstorm, product, tech, judge (custom is allowed only when clearly better).
- "voice" should be one of: ${BUILT_IN_VOICE_PROMPT_OPTIONS} (or a valid custom voice_* id if explicitly requested).
- Built-in voice descriptions:
${BUILT_IN_VOICE_DESCRIPTION_LIST}
- Pick a clear, human-readable "name" aligned with the persona.
- Never invent an avatar_url unless the user provided an explicit URL.
- Keep values practical and concise.

JSON only. No markdown code fences.`;
}

function buildGenerateUserMessage(text: string, context: ParsedAgent, stage: GenerateStage): string {
  const normalizedContext = normalizeAgentFields(context);
  const serializedContext =
    Object.keys(normalizedContext).length > 0
      ? JSON.stringify(normalizedContext, null, 2)
      : "{}";

  if (stage === "instruction") {
    return `User brief:
${text}

Existing fields (if any):
${serializedContext}`;
  }

  if (stage === "feedback_prompt") {
    return `User brief:
${text}

Current instructions:
${normalizedContext.instructions ?? "(none)"}

Context:
This feedback prompt is for evaluating the student's conversation behavior after they interact with the agent.
The agent should be treated as a high-quality baseline and not evaluated directly.

Existing fields (if any):
${serializedContext}`;
  }

  return `User brief:
${text}

Current instructions:
${normalizedContext.instructions ?? "(none)"}

Current feedback prompt:
${normalizedContext.feedback_prompt ?? "(none)"}

Existing fields (if any):
${serializedContext}`;
}

async function requestModelContent(options: {
  system: string;
  user: string;
  temperature: number;
  maxTokens: number;
  stage?: GenerationStep;
}): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages: [
      { role: "system", content: options.system },
      { role: "user", content: options.user },
    ],
    temperature: options.temperature,
    max_completion_tokens: options.maxTokens,
  });

  return completion.choices?.[0]?.message?.content || "";
}

function cleanModelTextOutput(content: string): string | undefined {
  const trimmed = cleanOptional(content);
  if (!trimmed) return undefined;

  const fencedMatch = /^```(?:\w+)?\s*([\s\S]*?)\s*```$/m.exec(trimmed);
  if (fencedMatch?.[1]) {
    return cleanOptional(fencedMatch[1]);
  }

  return trimmed;
}

function tryReadStringFieldFromJson(content: string, field: keyof ParsedAgent): string | undefined {
  const parsed = extractJsonFromText(content);
  if (!parsed || typeof parsed !== "object") return undefined;

  const value = (parsed as Record<string, unknown>)[field];
  return typeof value === "string" ? cleanOptional(value) : undefined;
}

async function requestTextFieldFromModel(options: {
  system: string;
  user: string;
  temperature: number;
  maxTokens: number;
  stage: GenerationStep;
  field: "instructions" | "feedback_prompt";
}): Promise<ParsedAgent> {
  const content = await requestModelContent(options);

  const fromJson = tryReadStringFieldFromJson(content, options.field);
  const value = fromJson || cleanModelTextOutput(content);
  if (!value) {
    throw {
      kind: "ai-output",
      message: `Model returned empty ${options.field}`,
      raw: content,
      stage: options.stage,
    } satisfies AiOutputError;
  }

  if (options.field === "instructions") {
    return { instructions: value };
  }

  return { feedback_prompt: value };
}

async function requestAgentFieldsFromModel(options: {
  system: string;
  user: string;
  temperature: number;
  maxTokens: number;
  stage?: GenerationStep;
}): Promise<ParsedAgent> {
  const content = await requestModelContent(options);
  const json = extractJsonFromText(content);
  if (!json) {
    throw {
      kind: "ai-output",
      message: "Failed to parse AI output",
      raw: content,
      stage: options.stage,
    } satisfies AiOutputError;
  }

  const validated = ParsedAgentSchema.safeParse(json);
  if (!validated.success) {
    throw {
      kind: "ai-output",
      message: "Invalid AI output",
      raw: content,
      details: validated.error.flatten(),
      stage: options.stage,
    } satisfies AiOutputError;
  }

  return normalizeAgentFields(validated.data);
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

    const { text, mode, step, context } = parsedReq.data;
    const normalizedContext = normalizeAgentFields(context || {});

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.OPENAI_API_KEY) {
      const heuristic = normalizeAgentFields(heuristicParse(text));

      if (mode === "fill") {
        const fields = normalizeAgentFields(
          ensureTypeAndVoice(
            { ...normalizedContext, ...heuristic },
            text,
            mode,
            { applyGenerateDefaults: false }
          )
        );
        return NextResponse.json({
          fields,
          warning: "OPENAI_API_KEY not configured. Used heuristic parsing.",
        });
      }

      const generated: ParsedAgent = { ...normalizedContext };
      if (step === "all" || step === "instruction") {
        generated.instructions = generated.instructions || heuristic.instructions || cleanOptional(text);
      }
      if (step === "all" || step === "feedback_prompt") {
        generated.feedback_prompt =
          generated.feedback_prompt ||
          heuristic.feedback_prompt ||
          "Evaluate the student's conversation behavior with this agent. Focus on the student's questions, responses, and specific actions; treat the agent as context, not the subject being evaluated.";
      }
      if (step === "all" || step === "metadata") {
        if (!generated.name) generated.name = heuristic.name;
        if (!generated.type) generated.type = heuristic.type;
        if (!generated.voice) generated.voice = heuristic.voice;
        if (!generated.avatar_url) generated.avatar_url = heuristic.avatar_url;
      }

      const fields = normalizeAgentFields(
        ensureTypeAndVoice(generated, text, mode, {
          applyGenerateDefaults: step === "all" || step === "metadata",
        })
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

    if (mode === "fill") {
      const extracted = await requestAgentFieldsFromModel({
        system: systemPromptFill,
        user: text,
        temperature: 0.2,
        maxTokens: 700,
      });

      const fields = normalizeAgentFields(
        ensureTypeAndVoice({ ...normalizedContext, ...extracted }, text, mode, {
          applyGenerateDefaults: false,
        })
      );
      return NextResponse.json({ fields });
    }

    let generated: ParsedAgent = { ...normalizedContext };
    const stagesToRun: GenerateStage[] =
      step === "all" ? GENERATION_STAGE_ORDER : [step];

    for (const generationStage of stagesToRun) {
      let stageFields: ParsedAgent;
      if (generationStage === "instruction") {
        stageFields = await requestTextFieldFromModel({
          stage: generationStage,
          field: "instructions",
          system: buildGenerateSystemPrompt(generationStage),
          user: buildGenerateUserMessage(text, generated, generationStage),
          temperature: 0.7,
          maxTokens: 1000,
        });
      } else if (generationStage === "feedback_prompt") {
        stageFields = await requestTextFieldFromModel({
          stage: generationStage,
          field: "feedback_prompt",
          system: buildGenerateSystemPrompt(generationStage),
          user: buildGenerateUserMessage(text, generated, generationStage),
          temperature: 0.5,
          maxTokens: 400,
        });
      } else {
        stageFields = await requestAgentFieldsFromModel({
          stage: generationStage,
          system: buildGenerateSystemPrompt(generationStage),
          user: buildGenerateUserMessage(text, generated, generationStage),
          temperature: 0.4,
          maxTokens: 500,
        });
      }

      generated = normalizeAgentFields({
        ...generated,
        ...stageFields,
      });
    }

    const fields = normalizeAgentFields(
      ensureTypeAndVoice(generated, text, mode, {
        applyGenerateDefaults: step === "all" || step === "metadata",
      })
    );
    return NextResponse.json({ fields, step });
  } catch (error) {
    if (isAiOutputError(error)) {
      return NextResponse.json(
        {
          error: error.message,
          details: error.details,
          raw: error.raw,
          stage: error.stage,
        },
        { status: 502 }
      );
    }

    // eslint-disable-next-line no-console
    console.error("Error in POST /api/agents/ai-parse:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
