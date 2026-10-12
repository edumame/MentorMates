import type React from "react";
import type { Metadata } from "next";
import { createSupabaseClient } from "@/app/utils/supabase/server";

// Per-project Open Graph / Twitter metadata so shared links unfurl with the
// project's own name, description, and cover image. Uses the anon server
// client so RLS applies — private projects fall back to generic metadata.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const fallback: Metadata = {
    title: "Project — MentorMates",
    description: "Explore hackathon projects on MentorMates.",
  };

  try {
    const supabase = await createSupabaseClient();
    const { data: project } = await supabase
      .from("projects")
      .select("project_name, project_description, cover_image_url, event_id")
      .eq("id", id)
      .maybeSingle();

    if (!project) return fallback;

    let eventName: string | null = null;
    if (project.event_id) {
      const { data: event } = await supabase
        .from("events")
        .select("event_name")
        .eq("event_id", project.event_id)
        .maybeSingle();
      eventName = event?.event_name ?? null;
    }

    const title = eventName
      ? `${project.project_name} — ${eventName}`
      : `${project.project_name} — MentorMates`;
    const description =
      project.project_description?.slice(0, 200) ||
      "Explore hackathon projects on MentorMates.";
    const images = project.cover_image_url
      ? [project.cover_image_url]
      : ["/mentormate.png"];

    return {
      title,
      description,
      openGraph: { title, description, images },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images,
      },
    };
  } catch {
    return fallback;
  }
}

export default function PublicProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
