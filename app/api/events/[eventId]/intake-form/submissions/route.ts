import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import type { IntakeFormAnswers } from "@/features/intake-forms/types";
import { getAuthContext } from "../../intake-forms/_shared";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const submitSchema = z.object({
  context: z.enum(["registration", "project_submission", "rsvp"]),
  formVersionId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  answers: z.record(z.string(), z.any()),
});

const querySchema = z.object({
  context: z.enum(["registration", "project_submission", "rsvp"]),
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
    const body = await request.json();
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

    // Registration submissions are allowed before joining; project submission
    // and RSVP require an existing role in the event.
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
        .select("id, lead_email, teammates")
        .eq("id", projectId)
        .maybeSingle();

      if (!project?.id) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      const userEmail = auth.user.email?.toLowerCase() ?? "";
      const teammateEmails = ((project.teammates as string[] | null) ?? []).map((email) =>
        email.toLowerCase()
      );
      const isProjectMember =
        (project.lead_email ?? "").toLowerCase() === userEmail ||
        teammateEmails.includes(userEmail);

      if (!isProjectMember && !auth.isOrganizer && !auth.isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const { data: version } = await auth.supabase
      .from("intake_form_versions")
      .select("id")
      .eq("id", formVersionId)
      .maybeSingle();

    if (!version?.id) {
      return NextResponse.json({ error: "Form version not found" }, { status: 404 });
    }

    let submissionId: string;

    const submissionLookup = auth.supabase
      .from("intake_form_submissions")
      .select("id")
      .eq("event_id", eventId)
      .eq("context", context)
      .eq("submitter_user_id", auth.user.id);

    const { data: existingSubmission } = projectId
      ? await submissionLookup.eq("project_id", projectId).maybeSingle()
      : await submissionLookup.is("project_id", null).maybeSingle();

    if (existingSubmission?.id) {
      submissionId = existingSubmission.id as string;

      const { error: updateError } = await auth.supabase
        .from("intake_form_submissions")
        .update({
          form_version_id: formVersionId,
          status: "submitted",
          submitted_at: new Date().toISOString(),
        })
        .eq("id", submissionId);

      if (updateError) {
        return NextResponse.json({ error: "Failed to update submission" }, { status: 500 });
      }
    } else {
      const { data: createdSubmission, error: insertError } = await auth.supabase
        .from("intake_form_submissions")
        .insert({
          event_id: eventId,
          context,
          form_version_id: formVersionId,
          submitter_user_id: auth.user.id,
          project_id: projectId ?? null,
          status: "submitted",
          submitted_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insertError || !createdSubmission?.id) {
        return NextResponse.json({ error: "Failed to create submission" }, { status: 500 });
      }

      submissionId = createdSubmission.id as string;
    }

    const { error: deleteAnswersError } = await auth.supabase
      .from("intake_form_submission_answers")
      .delete()
      .eq("submission_id", submissionId);

    if (deleteAnswersError) {
      return NextResponse.json({ error: "Failed to update answers" }, { status: 500 });
    }

    const answerRecords = Object.entries(answers as IntakeFormAnswers).map(
      ([fieldKey, value]) => ({
        submission_id: submissionId,
        form_version_id: formVersionId,
        field_key: fieldKey,
        value_json: value,
      })
    );

    if (answerRecords.length > 0) {
      const { error: answerInsertError } = await auth.supabase
        .from("intake_form_submission_answers")
        .insert(answerRecords);

      if (answerInsertError) {
        return NextResponse.json({ error: "Failed to save answers" }, { status: 500 });
      }
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
