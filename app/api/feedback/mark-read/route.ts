import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { fetchUserProjectIds } from "@/lib/projects/user-project-ids";

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
      // Mark all feedback as read for user's projects
      const { projectIds, error: projectsError } = await fetchUserProjectIds(
        supabase,
        user.email,
      );

      if (projectsError) {
        console.error("Error fetching user projects:", projectsError);
        return NextResponse.json(
          { error: "Failed to mark all as read" },
          { status: 500 }
        );
      }

      if (projectIds.length === 0) {
        return NextResponse.json({ success: true });
      }

      // Get all feedback for these projects
      const { data: feedbackItems, error: feedbackError } = await supabase
        .from("feedback")
        .select("id")
        .in("project_id", projectIds);

      if (feedbackError) {
        console.error("Error fetching feedback:", feedbackError);
        return NextResponse.json(
          { error: "Failed to mark all as read" },
          { status: 500 }
        );
      }

      const feedbackIds = feedbackItems?.map((f) => f.id) || [];

      if (feedbackIds.length === 0) {
        return NextResponse.json({ success: true });
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
