import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import OpenAI from "openai";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * Translate long-form user content via AI and cache the result.
 *
 * Phase 4 of the multi-language support rollout (#659).
 *
 * Design:
 * - Hash the source text with SHA-256
 * - Check content_translations cache for (source_hash, target_lang)
 * - Cache hit → return immediately
 * - Cache miss → call OpenAI (gpt-4o-mini for cost) with a glossary-aware
 *   system prompt, insert into cache, return translation
 *
 * POST /api/translate
 * Body: { text: string, target_lang: string, source_lang?: string }
 */

const translateSchema = z.object({
  text: z.string().min(1).max(10_000),
  target_lang: z.string().min(2).max(10),
  source_lang: z.string().min(2).max(10).optional(),
});

// Canonical jargon to preserve in English even when translating
const HACKATHON_GLOSSARY = [
  "hackathon",
  "pitch day",
  "demo day",
  "track",
  "MVP",
  "API",
  "LLM",
  "GitHub",
  "repo",
  "pull request",
  "PR",
  "MentorMates",
];

const LOCALE_NAMES: Record<string, string> = {
  en: "English",
  zh: "Simplified Chinese",
  "zh-CN": "Simplified Chinese",
  "zh-TW": "Traditional Chinese",
  es: "Spanish",
  ja: "Japanese",
  ko: "Korean",
  fr: "French",
  de: "German",
};

function buildSystemPrompt(targetLang: string): string {
  const targetName = LOCALE_NAMES[targetLang] || targetLang;
  return `You are a translator for a hackathon platform called MentorMates. Translate the user's text into ${targetName}.

Rules:
1. Preserve these terms in English (do not translate): ${HACKATHON_GLOSSARY.join(", ")}.
2. Preserve all markdown formatting (headers, lists, links, bold, italics, code blocks).
3. Preserve URLs, email addresses, and user handles exactly.
4. Preserve the tone and register — if the source is casual, keep it casual; if formal, keep it formal.
5. Return ONLY the translation, no preamble, no explanation, no quotes around it.`;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = translateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { text, target_lang, source_lang } = parsed.data;

    // Compute the source hash for cache lookup
    const sourceHash = createHash("sha256").update(text).digest("hex");

    const serviceSupabase = createSupabaseServiceClient();

    // Cache lookup
    const { data: cached } = await serviceSupabase
      .from("content_translations")
      .select("translated_text, model, created_at")
      .eq("source_hash", sourceHash)
      .eq("target_lang", target_lang)
      .maybeSingle();

    if (cached) {
      return NextResponse.json({
        translated_text: cached.translated_text,
        cached: true,
        model: cached.model,
      });
    }

    // Cache miss — call the translation model
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Translation service not configured" },
        { status: 503 }
      );
    }

    const openai = new OpenAI({ apiKey });
    const model = "gpt-4o-mini"; // cheap + fast for short-to-medium text
    const systemPrompt = buildSystemPrompt(target_lang);

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      temperature: 0.2,
    });

    const translatedText = completion.choices[0]?.message?.content?.trim();
    if (!translatedText) {
      return NextResponse.json(
        { error: "Translation model returned empty response" },
        { status: 502 }
      );
    }

    // Store in cache (fire-and-forget — don't block the response)
    serviceSupabase
      .from("content_translations")
      .insert({
        source_hash: sourceHash,
        source_lang: source_lang ?? null,
        target_lang,
        translated_text: translatedText,
        model,
        token_count: completion.usage?.total_tokens ?? null,
      })
      .then(({ error: insertError }) => {
        if (insertError) {
          console.error("Failed to cache translation:", insertError);
        }
      });

    return NextResponse.json({
      translated_text: translatedText,
      cached: false,
      model,
    });
  } catch (error) {
    console.error("Translation error:", error);
    return NextResponse.json(
      { error: "Translation failed" },
      { status: 500 }
    );
  }
}
