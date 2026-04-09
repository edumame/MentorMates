import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createSupabaseClient } from "@/app/utils/supabase/server";

/**
 * POST /api/events/ai-chat/parse-file
 *
 * Accepts a rubric/criteria document (CSV, TXT, PDF, DOC) and uses AI to
 * parse it into MentorMates scoring config format (tracks + criteria).
 *
 * Body: FormData with "file" field
 * Returns: { success: true, config: EventScoringConfig }
 */

const PARSE_SYSTEM_PROMPT = `You are a document parser for a hackathon judging platform called MentorMates.

The user will upload a rubric document (CSV, TXT, PDF text, or DOC text). Parse it into this JSON structure:

{
  "tracks": {
    "<generated_uuid>": {
      "name": "Track Name",
      "criteria": [
        {
          "id": "<generated_uuid>",
          "name": "Criterion Name",
          "description": "What judges should evaluate",
          "weight": 1,
          "min": 1,
          "max": 10,
          "type": "numeric"
        }
      ]
    }
  },
  "defaultMin": 1,
  "defaultMax": 10,
  "defaultWeight": 1
}

Rules:
1. Generate UUIDs for track and criterion IDs (use format like "track-1234", "crit-5678").
2. If the document has multiple sections/categories, treat each as a separate track.
3. If there's only one category or no clear sections, create a single track called "Main Track".
4. Extract criterion names, descriptions, and any scoring ranges mentioned.
5. If weights are mentioned (percentages, points), convert to numeric weights.
6. If min/max ranges are mentioned (e.g., "1-5", "0-100"), use those. Otherwise default to 1-10.
7. If the document is unclear or has no usable content, return an empty tracks object.

Respond ONLY with valid JSON matching the structure above. No explanation, no markdown.`;

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

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      "text/csv",
      "text/plain",
      "text/markdown",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    const allowedExtensions = [".csv", ".txt", ".md", ".pdf", ".doc", ".docx"];
    const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;

    if (
      !allowedTypes.includes(file.type) &&
      !allowedExtensions.includes(ext)
    ) {
      return NextResponse.json(
        {
          error: `Unsupported file type: ${file.type || ext}. Accepted: CSV, TXT, PDF, DOC, DOCX.`,
        },
        { status: 400 }
      );
    }

    // Read file content
    let textContent: string;

    if (file.type === "application/pdf") {
      // For PDFs, we send the raw text to AI — in a production app you'd use
      // a PDF parser like pdf-parse. For now, read as text (works for text-based PDFs).
      const buffer = await file.arrayBuffer();
      textContent = new TextDecoder("utf-8").decode(buffer);
      // If it's binary PDF, the text will be garbled — AI will handle gracefully
    } else {
      textContent = await file.text();
    }

    if (!textContent.trim()) {
      return NextResponse.json(
        { error: "File is empty" },
        { status: 400 }
      );
    }

    // Truncate very large files
    const maxChars = 15000;
    if (textContent.length > maxChars) {
      textContent = textContent.slice(0, maxChars) + "\n\n[... truncated]";
    }

    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        { role: "system", content: PARSE_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Parse this rubric document into scoring tracks and criteria:\n\nFilename: ${file.name}\n\n${textContent}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "AI returned empty response", success: false },
        { status: 502 }
      );
    }

    try {
      const parsed = JSON.parse(content);

      // Validate the structure has tracks
      if (!parsed.tracks || typeof parsed.tracks !== "object") {
        return NextResponse.json({
          success: false,
          error: "Could not extract tracks from the document. Try a clearer format.",
        });
      }

      return NextResponse.json({
        success: true,
        config: {
          tracks: parsed.tracks,
          defaultMin: parsed.defaultMin ?? 1,
          defaultMax: parsed.defaultMax ?? 10,
          defaultWeight: parsed.defaultWeight ?? 1,
        },
      });
    } catch {
      return NextResponse.json({
        success: false,
        error: "Failed to parse AI response. Try again or use a simpler document.",
      });
    }
  } catch (error) {
    console.error("Parse file error:", error);
    return NextResponse.json(
      { error: "Failed to process file" },
      { status: 500 }
    );
  }
}
