import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const moderation = await openai.moderations.create({
    model: "omni-moderation-latest",
    input: body.feedback_text,
  });

  if (moderation.results[0].flagged) {
    return NextResponse.json(
      {
        error:
          "Feedback contains inappropriate content. Do not submit feedback that contains harassment, violence, or sexual content. ",
      },
      { status: 400 }
    );
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
