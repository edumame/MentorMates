import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";

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
      const { data: userProjects } = await supabase
        .from("projects")
        .select("id")
        .or(`owner_id.eq.${user.id},team_members.cs.{"${user.id}"}`);

      const projectIds = userProjects?.map((p) => p.id) || [];

      if (projectIds.length === 0) {
        return NextResponse.json({ success: true });
      }

      // Get all feedback for these projects
      const { data: feedbackItems } = await supabase
        .from("feedback")
        .select("id")
        .in("project_id", projectIds);

      const feedbackIds = feedbackItems?.map((f) => f.id) || [];

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
