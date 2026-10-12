import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseClient } from "@/app/utils/supabase/server";
import { PER_USER_INTAKE_FORM_CONTEXTS } from "@/features/intake-forms/types";

// Project submissions are per-project, not per-user, so they have no
// meaningful per-user completion status and are excluded here.
const querySchema = z.object({
  context: z.enum(PER_USER_INTAKE_FORM_CONTEXTS),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const parsed = querySchema.safeParse({
      context: request.nextUrl.searchParams.get("context"),
    });

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid context" }, { status: 400 });
    }

    const { context } = parsed.data;
    const supabase = await createSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("event_id")
      .eq("event_id", eventId)
      .maybeSingle();

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const { data: binding } = await supabase
      .from("event_intake_form_bindings")
      .select("form_version_id")
      .eq("event_id", eventId)
      .eq("context", context)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const hasActiveForm = Boolean(binding?.form_version_id);

    if (!hasActiveForm) {
      return NextResponse.json({
        hasActiveForm,
        completed: false,
      });
    }

    const { data: submission } = await supabase
      .from("intake_form_submissions")
      .select("id")
      .eq("event_id", eventId)
      .eq("context", context)
      .eq("submitter_user_id", user.id)
      .eq("status", "submitted")
      .maybeSingle();

    return NextResponse.json({
      hasActiveForm,
      completed: Boolean(submission?.id),
    });
  } catch (error) {
    console.error(
      "Error in GET /api/events/[eventId]/intake-form/status:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
