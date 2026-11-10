import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  INTAKE_FORM_CONTEXTS,
  type IntakeFormContext,
  type IntakeFormSchema,
} from "@/features/intake-forms/types";
import { getAuthContext } from "../intake-forms/_shared";

const querySchema = z.object({
  context: z.enum(INTAKE_FORM_CONTEXTS),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const parseResult = querySchema.safeParse({
      context: request.nextUrl.searchParams.get("context"),
    });

    if (!parseResult.success) {
      return NextResponse.json({ error: "Invalid context" }, { status: 400 });
    }

    const context = parseResult.data.context;
    const auth = await getAuthContext(eventId);

    if (!auth.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // All non-registration flows (project submission, RSVP, post-survey):
    // user must have a role in the event, unless admin. Registration flow is
    // accessible to any authenticated user so they can complete the
    // questionnaire before joining.
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

    const { data: binding } = await auth.supabase
      .from("event_intake_form_bindings")
      .select("form_version_id")
      .eq("event_id", eventId)
      .eq("context", context)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!binding?.form_version_id) {
      return NextResponse.json({ form: null });
    }

    const { data: version } = await auth.supabase
      .from("intake_form_versions")
      .select("id, version_number, schema_json")
      .eq("id", binding.form_version_id)
      .single();

    if (!version?.id) {
      return NextResponse.json({ form: null });
    }

    let answers: Record<string, unknown> = {};
    // Project questionnaires need a project ID; only per-user contexts can
    // restore answers from this endpoint. Never use another user's submission.
    if (context !== "project_submission") {
      const { data: submission, error: submissionError } = await auth.supabase
        .from("intake_form_submissions")
        .select("id")
        .eq("event_id", eventId)
        .eq("context", context)
        .eq("submitter_user_id", auth.user.id)
        .eq("form_version_id", version.id)
        .eq("status", "submitted")
        .maybeSingle();
      if (submissionError) throw submissionError;
      if (submission) {
        const { data: rows, error: answersError } = await auth.supabase
          .from("intake_form_submission_answers")
          .select("field_key, value_json")
          .eq("submission_id", submission.id);
        if (answersError) throw answersError;
        answers = Object.fromEntries((rows || []).map(row => [row.field_key, row.value_json]));
      }
    }

    return NextResponse.json({
      form: {
        formVersionId: version.id,
        versionNumber: version.version_number,
        schema: version.schema_json as IntakeFormSchema,
        answers,
      },
      context: context as IntakeFormContext,
    });
  } catch (error) {
    console.error("Error in GET /api/events/[eventId]/intake-form:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
