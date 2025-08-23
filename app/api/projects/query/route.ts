import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createJsonCompletion } from "@/lib/ai/openai";

const RequestSchema = z.object({
  projectId: z.string().min(1),
  query: z.string().min(1),
  artifacts: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseClient();

  try {
    const body = await request.json();
    const parse = RequestSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parse.error.flatten() },
        { status: 400 }
      );
    }

    const { projectId, query, artifacts = {}, metadata = {} } = parse.data;

    // Fetch minimal project context to ensure RLS and existence
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select(
        `id, project_name, project_description, lead_name, lead_email, teammates, project_url, additional_materials_url, video_url, cover_image_url, event_id, created_at, submitted`
      )
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Optionally fetch tracks
    const { data: tracks } = await supabase
      .from("project_tracks")
      .select(
        `event_tracks (track_id, event_id, name, description, label, scoring_criteria)`
      )
      .eq("project_id", projectId);

    const projectContext = {
      project,
      tracks: (tracks ?? []).map((t) => t.event_tracks).filter(Boolean),
      artifacts,
      metadata,
      query,
    };

    const systemPrompt = `You are an assistant for the MentorMates platform. You receive a project context consisting of:
- files/artifacts JSON (code snippets, docs),
- metadata JSON (structured info about the project and environment), and
- a user query.

Your task: respond with the most appropriate answer in STRICT JSON format. Do not include any prose outside of JSON. The JSON should have at least these fields:
{
  "answer": string,             // your concise answer
  "reasoning": string,          // brief reasoning for traceability
  "references": string[]        // optional list of relevant artifact keys or URLs
}
If you cannot answer, return { "answer": "unknown", "reasoning": "...", "references": [] }.`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: JSON.stringify(projectContext) },
    ];

    // Use GPT-5 Nano as requested
    const content = await createJsonCompletion({
      model: "gpt-5-nano",
      messages,
      temperature: 0.2,
      maxTokens: 1200,
    });

    // Ensure valid JSON response
    let jsonResponse: unknown;
    try {
      jsonResponse = JSON.parse(content);
    } catch {
      jsonResponse = { answer: content, reasoning: "Model returned non-JSON; coerced.", references: [] };
    }

    return NextResponse.json({ result: jsonResponse });
  } catch (error) {
    console.error("Error in project query:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}