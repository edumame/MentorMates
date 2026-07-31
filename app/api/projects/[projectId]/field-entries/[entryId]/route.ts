import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { entryRowToPayload } from "@/lib/projects/field-entries";

const updateEntrySchema = z.object({
  content: z.string().trim().min(1).max(5000),
});

const ENTRY_COLUMNS =
  "id, project_id, event_submission_field_id, submitter_user_id, content, created_at, updated_at";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; entryId: string }> },
) {
  try {
    const { projectId, entryId } = await params;
    const supabase = await createSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await request.json();
    const parsed = updateEntrySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // RLS limits updates to the submitter, event organizers, and admins.
    const { data: updated, error } = await supabase
      .from("project_field_entries")
      .update({ content: parsed.data.content })
      .eq("id", entryId)
      .eq("project_id", projectId)
      .select(ENTRY_COLUMNS)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "Failed to update entry" },
        { status: 500 },
      );
    }

    if (!updated) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json({ entry: entryRowToPayload(updated) });
  } catch (error) {
    console.error(
      "PATCH /projects/[projectId]/field-entries/[entryId] error:",
      error,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; entryId: string }> },
) {
  try {
    const { projectId, entryId } = await params;
    const supabase = await createSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // RLS limits deletes to the submitter, event organizers, and admins.
    const { data: deleted, error } = await supabase
      .from("project_field_entries")
      .delete()
      .eq("id", entryId)
      .eq("project_id", projectId)
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "Failed to delete entry" },
        { status: 500 },
      );
    }

    if (!deleted) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      "DELETE /projects/[projectId]/field-entries/[entryId] error:",
      error,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
