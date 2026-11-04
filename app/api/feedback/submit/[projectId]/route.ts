import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null as unknown as OpenAI;

function optionalText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function optionalTextArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {

  const body: unknown = await request.json().catch(() => null);
  const { projectId } = await params;


  if (!projectId) {
    return NextResponse.json(
      { error: "Project ID is required" },
      { status: 400 }
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const input = body as Record<string, unknown>;
  const feedbackText = input.feedback_text;

  if (typeof feedbackText !== "string" || !feedbackText.trim()) {
    return NextResponse.json(
      { error: "Feedback text is required" },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, event_id")
    .eq("id", projectId)
    .single();

  if (projectError) {
    console.error("Project lookup error:", projectError);
    return NextResponse.json(
      { error: "Could not find project" },
      { status: 404 }
    );
  }

  // Try moderation if OpenAI is configured, but don't fail if it's not
  if (process.env.OPENAI_API_KEY && openai) {
    try {
      const moderation = await openai.moderations.create({
        model: "omni-moderation-latest",
        input: feedbackText,
      });

      if (moderation.results[0].flagged) {
        return NextResponse.json(
          {
            error:
              "Feedback contains inappropriate content. Do not submit feedback that contains harassment, violence, or sexual content.",
          },
          { status: 400 }
        );
      }
    } catch (moderationError) {
      // Log the error but continue with submission
      console.warn("Moderation check failed, continuing without it:", moderationError);
    }
  }

  // Allow anonymous feedback submission. The sender comes only from the
  // session and the project only from the URL; the body is never trusted for
  // either, so only the feedback content below is read from it.
  const { error } = await supabase.from("feedback").insert([
    {
      project_id: projectId,
      event_id: project.event_id,
      mentor_id: user?.id ?? null,
      mentor_name: user?.user_metadata?.full_name || null,
      mentor_email: user?.email || null,
      feedback_text: feedbackText,
      original_feedback_text: optionalText(input.original_feedback_text),
      modifier_field: optionalTextArray(input.modifier_field),
      specific_ai_suggestion: optionalText(input.specific_ai_suggestion),
      positive_ai_suggestion: optionalText(input.positive_ai_suggestion),
      actionable_ai_suggestion: optionalText(input.actionable_ai_suggestion),
    },
  ]);

  if (error) {
    console.error("Feedback submission error:", error);
    return NextResponse.json(
      { error: "Feedback submission failed" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { message: "Feedback submitted successfully" },
    { status: 200 }
  );
}
