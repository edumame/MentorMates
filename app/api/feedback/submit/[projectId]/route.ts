import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null as unknown as OpenAI;

const optionalText = z.string().max(5000).optional().nullable();

// Only content fields are accepted from the client. Authorship (mentor_id,
// mentor_name, mentor_email), project_id and event_id are derived on the
// server (MENT-001); unknown keys are stripped rather than inserted.
const feedbackSubmissionSchema = z.object({
  feedback_text: z.string().trim().min(1).max(10000),
  original_feedback_text: z.string().max(10000).optional().nullable(),
  modifier_field: z.array(z.string().max(100)).max(20).optional().nullable(),
  specific_ai_suggestion: optionalText,
  positive_ai_suggestion: optionalText,
  actionable_ai_suggestion: optionalText,
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  if (!projectId || !UUID_RE.test(projectId)) {
    return NextResponse.json(
      { error: "Project ID is required" },
      { status: 400 }
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = feedbackSubmissionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid feedback", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const body = parsed.data;

  const supabase = await createSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS limits this read to projects the caller may view (public projects, or
  // projects of events the caller belongs to).
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, event_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError || !project) {
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
        input: body.feedback_text,
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

  // Anonymous feedback is unattributed; signed-in feedback is always attributed
  // to the caller. The database also enforces both rules and derives the
  // mentor name from the profile.
  const row = {
    ...body,
    project_id: project.id,
    event_id: project.event_id ?? null,
    mentor_id: user?.id ?? null,
    mentor_name: user ? user.user_metadata?.full_name || null : null,
  };

  const { error } = await supabase.from("feedback").insert([row]);

  if (error) {
    if (error.code === "42501") {
      return NextResponse.json(
        { error: "You cannot submit feedback for this project" },
        { status: 403 }
      );
    }
    console.error("Feedback submission error:", error.code);
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
