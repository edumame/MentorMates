import { NextRequest, NextResponse } from "next/server";
import { getUserProjectIds } from "@/lib/projects/membership";
import { z } from "zod";

import {
  INTAKE_FORM_CONTEXTS,
  type IntakeFormSchema,
} from "@/features/intake-forms/types";
import { validateIntakeAnswers } from "@/features/intake-forms/validation";
import { getAuthContext } from "../../intake-forms/_shared";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/lib/database.types";

/** ORG-010: hard cap on the request body (answers are free-form JSON). */
const MAX_SUBMISSION_BYTES = 256 * 1024;

const submitSchema = z.object({
  context: z.enum(INTAKE_FORM_CONTEXTS),
  formVersionId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  answers: z.record(z.string(), z.any()),
});

const querySchema = z.object({
  context: z.enum(INTAKE_FORM_CONTEXTS),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const parsed = querySchema.safeParse({
      context: request.nextUrl.searchParams.get("context"),
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
      offset: request.nextUrl.searchParams.get("offset") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { context, limit, offset } = parsed.data;
    const auth = await getAuthContext(eventId);

    if (!auth.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!auth.isOrganizer && !auth.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const serviceSupabase = createSupabaseServiceClient();

    const { data: submissionRows, count, error: submissionError } =
      await serviceSupabase
        .from("intake_form_submissions")
        .select(
          `
          id,
          submitter_user_id,
          form_version_id,
          project_id,
          status,
          submitted_at,
          created_at,
          intake_form_submission_answers (
            field_key,
            value_json
          )
        `,
          { count: "exact" }
        )
        .eq("event_id", eventId)
        .eq("context", context)
        .eq("status", "submitted")
        .order("submitted_at", { ascending: false })
        .range(offset, offset + limit - 1);

    if (submissionError) {
      return NextResponse.json(
        { error: "Failed to fetch submissions" },
        { status: 500 }
      );
    }

    const submitterIds = Array.from(
      new Set(
        (submissionRows ?? [])
          .map((submission) => submission.submitter_user_id)
          .filter(Boolean)
      )
    );

    const profileMap = new Map<string, { display_name: string | null; email: string | null }>();

    if (submitterIds.length > 0) {
      const { data: profileRows } = await serviceSupabase
        .from("user_profiles")
        .select("uid, display_name, email")
        .in("uid", submitterIds);

      (profileRows ?? []).forEach((profile) => {
        profileMap.set(profile.uid, {
          display_name: profile.display_name,
          email: profile.email,
        });
      });
    }

    const submissions = (submissionRows ?? []).map((submission) => ({
      id: submission.id,
      submitterUserId: submission.submitter_user_id,
      formVersionId: submission.form_version_id,
      projectId: submission.project_id,
      status: submission.status,
      submittedAt: submission.submitted_at,
      createdAt: submission.created_at,
      submitterProfile: profileMap.get(submission.submitter_user_id) ?? null,
      answers: (submission.intake_form_submission_answers ?? []).map((answer) => ({
        fieldKey: answer.field_key,
        value: answer.value_json,
      })),
    }));

    return NextResponse.json({
      submissions,
      pagination: {
        limit,
        offset,
        total: count ?? 0,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/events/[eventId]/intake-form/submissions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;

    // ORG-010: bound the request size before parsing (answers are free-form).
    const declaredLength = Number(request.headers.get("content-length") ?? "0");
    if (declaredLength > MAX_SUBMISSION_BYTES) {
      return NextResponse.json({ error: "Submission is too large" }, { status: 413 });
    }
    const rawBody = await request.text().catch(() => "");
    if (rawBody.length > MAX_SUBMISSION_BYTES) {
      return NextResponse.json({ error: "Submission is too large" }, { status: 413 });
    }
    let body: unknown = null;
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = null;
    }
    const parsed = submitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { context, formVersionId, projectId, answers } = parsed.data;
    const auth = await getAuthContext(eventId);

    if (!auth.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Registration submissions are allowed before joining; all other contexts
    // (project submission, RSVP, post-survey) require an existing role in the
    // event.
    if (!auth.isAdmin && context !== "registration") {
      const { data: roleRow } = await auth.supabase
        .from("user_event_roles")
        .select("id")
        .eq("event_id", eventId)
        .eq("user_id", auth.user.id)
        .maybeSingle();

      if (!roleRow?.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (context === "project_submission" && !projectId) {
      return NextResponse.json(
        { error: "projectId is required for project_submission context" },
        { status: 400 }
      );
    }

    if (context !== "project_submission" && projectId) {
      return NextResponse.json(
        { error: `projectId must not be provided for ${context} context` },
        { status: 400 }
      );
    }

    if (projectId) {
      const { data: project } = await auth.supabase
        .from("projects")
        .select("id, event_id")
        .eq("id", projectId)
        .maybeSingle();

      if (!project?.id) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      // ORG-010: a project from another event cannot answer this event's form.
      if (project.event_id !== eventId) {
        return NextResponse.json(
          { error: "Project does not belong to this event" },
          { status: 400 }
        );
      }

      // Team email columns are not client-readable; membership comes from
      // my_project_ids (verified auth email, case-insensitive).
      const { ids: myProjectIds } = await getUserProjectIds(auth.supabase, eventId);
      const isProjectMember = Boolean(myProjectIds?.includes(project.id));

      if (!isProjectMember && !auth.isOrganizer && !auth.isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // All reads/writes below use the service client: the user-facing RLS
    // policies no longer allow participants to write submissions directly
    // (see supabase/migrations/202611080402_c_intake_submission_writes.sql),
    // so this route is the only writer and enforces the checks below.
    const serviceSupabase = createSupabaseServiceClient();

    // ORG-010: archived events are read-only, and drafts are not open for
    // registration yet.
    const { data: eventRow, error: eventError } = await serviceSupabase
      .from("events")
      .select("visibility")
      .eq("event_id", eventId)
      .maybeSingle();
    if (eventError) {
      return NextResponse.json({ error: "Failed to load event" }, { status: 500 });
    }
    if (!eventRow) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    if (
      eventRow.visibility === "archived" ||
      (context === "registration" && eventRow.visibility === "draft")
    ) {
      return NextResponse.json(
        { error: "This event is not accepting form submissions" },
        { status: 409 }
      );
    }

    // The submitted version must be the form currently active for this event
    // and context; otherwise any version (even another event's) was accepted.
    const { data: binding, error: bindingError } = await serviceSupabase
      .from("event_intake_form_bindings")
      .select("form_version_id")
      .eq("event_id", eventId)
      .eq("context", context)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (bindingError) {
      return NextResponse.json({ error: "Failed to load form" }, { status: 500 });
    }

    if (!binding?.form_version_id) {
      return NextResponse.json(
        { error: "This event has no active form for this step" },
        { status: 404 }
      );
    }

    if (binding.form_version_id !== formVersionId) {
      return NextResponse.json(
        {
          error: "This form was updated. Please reload the page and submit again.",
          code: "stale_form_version",
        },
        { status: 409 }
      );
    }

    const { data: version, error: versionError } = await serviceSupabase
      .from("intake_form_versions")
      .select("id, schema_json")
      .eq("id", formVersionId)
      .maybeSingle();

    if (versionError) {
      return NextResponse.json({ error: "Failed to load form" }, { status: 500 });
    }

    if (!version?.id) {
      return NextResponse.json({ error: "Form version not found" }, { status: 404 });
    }

    const validation = validateIntakeAnswers(
      version.schema_json as IntakeFormSchema,
      answers
    );

    if (!validation.ok) {
      return NextResponse.json(
        { error: "Some answers are missing or invalid", fieldErrors: validation.errors },
        { status: 400 }
      );
    }

    // ORG-010: submission row + answers are written in one transaction by
    // public.submit_intake_form (supabase/migrations/202611080405_c_round2.sql),
    // so a failure can never leave a "submitted" row with missing answers.
    const { data: submissionId, error: submitError } = await serviceSupabase.rpc(
      "submit_intake_form",
      {
        p_event_id: eventId,
        p_context: context,
        p_form_version_id: formVersionId,
        p_user_id: auth.user.id,
        p_project_id: projectId ?? null,
        p_answers: validation.answers as Json,
      }
    );

    if (submitError || !submissionId) {
      console.error("Error saving intake submission:", submitError);
      return NextResponse.json({ error: "Failed to save submission" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      submissionId,
    });
  } catch (error) {
    console.error("Error in POST /api/events/[eventId]/intake-form/submissions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
