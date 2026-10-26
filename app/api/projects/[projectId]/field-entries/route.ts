import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { EventSubmissionField } from "@/lib/types";
import {
  buildEntryContent,
  entryContentInputSchema,
  entryRowToPayload,
} from "@/lib/projects/field-entries";

const createEntrySchema = z
  .object({
    fieldId: z.string().uuid(),
  })
  .and(entryContentInputSchema);

async function fetchVisibleProject(projectId: string) {
  // The cookie-based client enforces the projects select RLS, so a row only
  // comes back if the viewer (including anonymous viewers) may see it.
  const supabase = await createSupabaseClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, event_id")
    .eq("id", projectId)
    .maybeSingle();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, project, user };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const { project, user } = await fetchVisibleProject(projectId);

    if (!project || !project.event_id) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Field definitions are readable only by event members under RLS, but
    // entries on public projects must render for anonymous viewers too, so
    // reads go through the service client after the visibility check above.
    const serviceClient = createSupabaseServiceClient();
    const { data: fields, error: fieldsError } = await serviceClient
      .from("event_submission_fields")
      .select("*")
      .eq("event_id", project.event_id)
      .eq("is_active", true)
      .eq("allows_multiple_entries", true)
      .order("sort_order", { ascending: true })
      .overrideTypes<EventSubmissionField[]>();

    if (fieldsError) {
      return NextResponse.json(
        { error: "Failed to fetch entry fields" },
        { status: 500 },
      );
    }

    if (!fields || fields.length === 0) {
      return NextResponse.json({
        fields: [],
        entries: [],
        viewerUserId: user?.id ?? null,
      });
    }

    const { data: entries, error: entriesError } = await serviceClient
      .from("project_field_entries")
      .select(
        "id, project_id, event_submission_field_id, submitter_user_id, content, created_at, updated_at",
      )
      .eq("project_id", projectId)
      .in(
        "event_submission_field_id",
        fields.map((field) => field.id),
      )
      .order("created_at", { ascending: true });

    if (entriesError) {
      return NextResponse.json(
        { error: "Failed to fetch field entries" },
        { status: 500 },
      );
    }

    const submitterIds = Array.from(
      new Set((entries || []).map((entry) => entry.submitter_user_id)),
    );
    const displayNameByUserId = new Map<string, string | null>();
    if (submitterIds.length > 0) {
      const { data: profiles } = await serviceClient
        .from("user_profiles")
        .select("uid, display_name")
        .in("uid", submitterIds);
      for (const profile of profiles || []) {
        if (!profile.uid) continue;
        displayNameByUserId.set(profile.uid, profile.display_name);
      }
    }

    return NextResponse.json({
      fields,
      entries: (entries || []).map((entry) =>
        entryRowToPayload(entry, displayNameByUserId),
      ),
      viewerUserId: user?.id ?? null,
    });
  } catch (error) {
    console.error("GET /projects/[projectId]/field-entries error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const { supabase, project, user } = await fetchVisibleProject(projectId);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!project || !project.event_id) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const json = await request.json();
    const parsed = createEntrySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const serviceClient = createSupabaseServiceClient();
    const { data: field } = await serviceClient
      .from("event_submission_fields")
      .select("id, event_id, is_active, allows_multiple_entries")
      .eq("id", parsed.data.fieldId)
      .maybeSingle();

    if (
      !field ||
      field.event_id !== project.event_id ||
      !field.is_active ||
      !field.allows_multiple_entries
    ) {
      return NextResponse.json(
        { error: "Field does not accept multiple entries for this project" },
        { status: 400 },
      );
    }

    // Insert with the caller's client so the project_field_entries RLS
    // enforces membership and submitter attribution.
    const { data: created, error: insertError } = await supabase
      .from("project_field_entries")
      .insert({
        project_id: projectId,
        event_submission_field_id: field.id,
        submitter_user_id: user.id,
        content: buildEntryContent(parsed.data),
      })
      .select(
        "id, project_id, event_submission_field_id, submitter_user_id, content, created_at, updated_at",
      )
      .single();

    if (insertError || !created) {
      return NextResponse.json(
        { error: "You do not have permission to add entries to this project" },
        { status: 403 },
      );
    }

    const { data: profile } = await serviceClient
      .from("user_profiles")
      .select("uid, display_name")
      .eq("uid", user.id)
      .maybeSingle();

    return NextResponse.json(
      {
        entry: entryRowToPayload(
          created,
          new Map([[user.id, profile?.display_name ?? null]]),
        ),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /projects/[projectId]/field-entries error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
