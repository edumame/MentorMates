import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const supabase = await createSupabaseClient();
    const { projectId } = await params;

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Count total likes for this project
    const { count: totalCount, error: countError } = await supabase
      .from("project_likes")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId);

    if (countError) {
      return NextResponse.json({ error: "Failed to fetch likes count" }, { status: 500 });
    }

    let likedByMe = false;
    if (user) {
      const { data: existingLike, error: likeCheckError } = await supabase
        .from("project_likes")
        .select("id")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!likeCheckError && existingLike) {
        likedByMe = true;
      }
    }

    return NextResponse.json({ liked: likedByMe, count: totalCount || 0 });
  } catch (error) {
    console.error("GET /projects/[projectId]/like error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const supabase = await createSupabaseClient();
    const { projectId } = await params;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    // Upsert-like semantics: insert if not exists
    const { error: insertError } = await supabase
      .from("project_likes")
      .insert({ project_id: projectId, user_id: user.id })
      .select("id")
      .single();

    if (insertError && !insertError.message.includes("duplicate key")) {
      return NextResponse.json({ error: "Failed to like project" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /projects/[projectId]/like error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const supabase = await createSupabaseClient();
    const { projectId } = await params;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    const { error: deleteError } = await supabase
      .from("project_likes")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", user.id);

    if (deleteError) {
      return NextResponse.json({ error: "Failed to unlike project" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /projects/[projectId]/like error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
