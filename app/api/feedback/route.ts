import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getUserProjectIds } from "@/lib/projects/membership";
import { parseUtcTimestamp } from "@/lib/utils/parse-utc-timestamp";

export async function GET(request: Request) {
  const supabase = await createSupabaseClient();
  const serviceSupabase = createSupabaseServiceClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "6");
  const offset = (page - 1) * limit;

  try {

    // Get user's projects to find feedback for them (using lead_email and teammates)
    const { ids: projectIds, error: projectsError } = await getUserProjectIds(supabase);

    if (projectsError || !projectIds) {
      console.error("Error fetching user projects:", projectsError);
      return NextResponse.json(
        { error: "Error fetching projects" },
        { status: 500 }
      );
    }

    if (projectIds.length === 0) {
      return NextResponse.json({
        feedback: [],
        totalCount: 0,
        totalPages: 0,
      });
    }

    // Get feedback for user's projects
    const { data: feedbackData, error: feedbackError } = await supabase
      .from("feedback")
      .select("id, feedback_text, created_at, mentor_name, mentor_id, project_id")
      .in("project_id", projectIds)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (feedbackError) {
      console.error("Error fetching feedback:", feedbackError);
      return NextResponse.json(
        { error: "Error fetching feedback" },
        { status: 500 }
      );
    }

    // Get total count for pagination
    const { count, error: countError } = await supabase
      .from("feedback")
      .select("id", { count: "exact", head: true })
      .in("project_id", projectIds);

    if (countError) {
      console.error("Error counting feedback:", countError);
    }

    // Get read status for these feedback items
    const feedbackIds = feedbackData?.map((f) => f.id) || [];
    const { data: readStatuses } = await supabase
      .from("feedback_read_status")
      .select("feedback_id, read_at")
      .in("feedback_id", feedbackIds)
      .eq("user_id", user.id);

    const readStatusMap = new Map(
      readStatuses?.map((rs) => [rs.feedback_id, rs.read_at])
    );

    // Get project names
    const { data: projectsData } = await supabase
      .from("projects")
      .select("id, project_name")
      .in("id", projectIds);

    const projectMap = new Map(
      projectsData?.map((p) => [p.id, p.project_name])
    );

    // Get mentor profile data
    const mentorIds = feedbackData
      ?.map((f) => f.mentor_id)
      .filter((id): id is string => !!id) || [];

    const { data: mentorProfiles } = await serviceSupabase
      .from("user_profiles")
      .select("uid, avatar_url, display_name")
      .in("uid", mentorIds);

    const mentorMap = new Map(
      mentorProfiles?.map((m) => [
        m.uid,
        {
          avatar: m.avatar_url,
          name: m.display_name,
        },
      ])
    );

    // Transform feedback data
    const transformedFeedback = feedbackData?.map((f) => {
      const mentor = mentorMap.get(f.mentor_id || "");
      const readAt = readStatusMap.get(f.id);

      return {
        id: f.id,
        sender: {
          name: mentor?.name || f.mentor_name || "Anonymous",
          // null -> the inbox renders the sender's initials (AvatarFallback).
          avatar: mentor?.avatar || null,
          role: "Mentor",
        },
        projectName: projectMap.get(f.project_id || "") || "Unknown Project",
        message: f.feedback_text || "",
        // ISO (UTC); the client formats it in the viewer's time zone.
        date: parseUtcTimestamp(f.created_at)?.toISOString() ?? "",
        isRead: !!readAt,
      };
    });

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      feedback: transformedFeedback || [],
      totalCount: count || 0,
      totalPages,
      currentPage: page,
    });
  } catch (error) {
    console.error("Error in feedback route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
