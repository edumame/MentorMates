import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null as unknown as OpenAI;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {

  const body = await request.json();
  const { projectId } = await params;


  if (!projectId) {
    return NextResponse.json(
      { error: "Project ID is required" },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Allow anonymous feedback submission, but attach user info if available
  if (user) {
    body.mentor_id = user.id;
    body.mentor_name = user.user_metadata?.full_name || null;
    body.mentor_email = user.email || null;
  }

  const { error: projectError } = await supabase
    .from("projects")
    .select("id")
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

  // Ensure event_id is null if empty string (not all projects are tied to events)
  if (body.event_id === "" || body.event_id === undefined) {
    body.event_id = null;
  }

  const { error } = await supabase.from("feedback").insert([body]);

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
