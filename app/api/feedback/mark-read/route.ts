import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { getUserProjectIds } from "@/lib/projects/membership";

export async function POST(request: Request) {
  const supabase = await createSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { feedbackId, markAll } = body;

    if (markAll) {
      // Mark all feedback as read for user's projects. Same membership rule
      // as GET /api/feedback (lead_email / teammates by verified email); the
      // old owner_id/team_members columns don't exist, so this used to report
      // success while marking nothing (MENT-012).
      const { ids: projectIds, error: projectsError } = await getUserProjectIds(supabase);
      if (projectsError || !projectIds) {
        console.error("Error loading projects for mark-all-read:", projectsError);
        return NextResponse.json(
          { error: "Failed to mark all as read" },
          { status: 500 }
        );
      }

      if (projectIds.length === 0) {
        return NextResponse.json({ success: true, marked: 0 });
      }

      // Get all feedback for these projects
      const { data: feedbackItems, error: feedbackError } = await supabase
        .from("feedback")
        .select("id")
        .in("project_id", projectIds);
      if (feedbackError) {
        console.error("Error loading feedback for mark-all-read:", feedbackError);
        return NextResponse.json(
          { error: "Failed to mark all as read" },
          { status: 500 }
        );
      }

      const feedbackIds = feedbackItems?.map((f) => f.id) || [];
      if (feedbackIds.length === 0) {
        return NextResponse.json({ success: true, marked: 0 });
      }

      // Insert read status for all (using upsert to handle duplicates)
      const readStatusEntries = feedbackIds.map((id) => ({
        feedback_id: id,
        user_id: user.id,
      }));

      const { error: insertError } = await supabase
        .from("feedback_read_status")
        .upsert(readStatusEntries, {
          onConflict: "feedback_id,user_id",
          ignoreDuplicates: true,
        });

      if (insertError) {
        console.error("Error marking all as read:", insertError);
        return NextResponse.json(
          { error: "Failed to mark all as read" },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true, marked: feedbackIds.length });
    } else {
      // Mark single feedback as read
      if (!feedbackId) {
        return NextResponse.json(
          { error: "Feedback ID is required" },
          { status: 400 }
        );
      }

      const { error: insertError } = await supabase
        .from("feedback_read_status")
        .upsert(
          {
            feedback_id: feedbackId,
            user_id: user.id,
          },
          {
            onConflict: "feedback_id,user_id",
            ignoreDuplicates: true,
          }
        );

      if (insertError) {
        console.error("Error marking as read:", insertError);
        return NextResponse.json(
          { error: "Failed to mark as read" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in mark-read route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const supabase = await createSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const feedbackId = searchParams.get("feedbackId");

    if (!feedbackId) {
      return NextResponse.json(
        { error: "Feedback ID is required" },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabase
      .from("feedback_read_status")
      .delete()
      .eq("feedback_id", feedbackId)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("Error unmarking as read:", deleteError);
      return NextResponse.json(
        { error: "Failed to unmark as read" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in mark-read DELETE route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
