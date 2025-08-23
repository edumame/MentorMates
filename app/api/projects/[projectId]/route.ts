import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const supabase = await createSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;
    const body = await request.json();

    const allowedFields: string[] = [
      "project_name",
      "project_description",
      "project_url",
      "additional_materials_url",
      "cover_image_url",
      "lead_name",
      "lead_email",
      "teammates",
      // video_url may or may not exist in schema; ignore TS here
      "video_url",
    ];

    const updateData: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in body) {
        updateData[key] = body[key];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ message: "No updates provided" });
    }

    const { error } = await supabase
      .from("projects")
      .update(updateData)
      .eq("id", projectId);

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to update project" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

