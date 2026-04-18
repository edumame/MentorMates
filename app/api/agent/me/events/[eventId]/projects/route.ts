import { NextRequest, NextResponse } from "next/server";
import {
  authenticateAgentRequest,
  authorizeAgentEventAccess,
  requireScope,
  resolveAgentPathEvent,
} from "@/lib/agent/auth";
import { logAgentEvent } from "@/lib/agent/logging";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EventRole } from "@/lib/types";
import { listParticipantProjectsByEvent } from "@/lib/projects/participant-projects";
import {
  normalizeProjectWriteInput,
  saveProjectSubmission,
} from "@/lib/projects/submission-service";

/**
 * Safely parse a request body. The raw `await request.json()` throws
 * SyntaxError on malformed/empty bodies, which previously got eaten by the
 * outer catch and surfaced as a generic 500 — unhelpful for the CLI. Explicit
 * handling returns a clear 400 + logs the failure so operators can see it.
 */
async function safeJsonBody(
  request: NextRequest,
  logContext: Record<string, unknown>
): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  try {
    const body = await request.json();
    return { ok: true, body };
  } catch (err) {
    logAgentEvent("participant_projects_submit_invalid_json", logContext, err);
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "Request body must be valid JSON. Ensure Content-Type: application/json is set and the body is non-empty.",
        },
        { status: 400 }
      ),
    };
  }
}

async function fetchAgentUserProfile(userId: string) {
  const supabase = createSupabaseServiceClient();
  return supabase
    .from("user_profiles")
    .select("email, display_name")
    .eq("uid", userId)
    .maybeSingle();
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eventRef } = await context.params;
  const route = "GET /api/agent/me/events/[eventId]/projects";
  try {
    const auth = await authenticateAgentRequest(request, {
      allowMissingEventId: true,
    });
    if (auth instanceof NextResponse) return auth;

    const scopeError = requireScope(auth, "participant-projects:read");
    if (scopeError) return scopeError;

    const resolvedAuth = await resolveAgentPathEvent(auth, eventRef);
    if (resolvedAuth instanceof NextResponse) return resolvedAuth;

    const access = await authorizeAgentEventAccess(resolvedAuth, EventRole.Participant);
    if (access instanceof NextResponse) return access;

    const { data: profile, error: profileError } = await fetchAgentUserProfile(
      resolvedAuth.userId
    );

    if (profileError || !profile?.email) {
      logAgentEvent("participant_projects_list_profile_missing", {
        route,
        eventRef,
        eventId: resolvedAuth.eventId,
        userId: resolvedAuth.userId,
        keyId: resolvedAuth.keyId,
      });
      return NextResponse.json(
        { error: "User email not found" },
        { status: 400 }
      );
    }

    const projects = await listParticipantProjectsByEvent(
      createSupabaseServiceClient(),
      resolvedAuth.eventId,
      profile.email
    );

    return NextResponse.json({ projects });
  } catch (error) {
    logAgentEvent(
      "participant_projects_list_crashed",
      { route, eventRef },
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eventRef } = await context.params;
  const route = "POST /api/agent/me/events/[eventId]/projects";
  // Context progressively enriched as we resolve auth — logged with every failure.
  const logCtx: Record<string, unknown> = { route, eventRef };

  try {
    const auth = await authenticateAgentRequest(request, {
      allowMissingEventId: true,
    });
    if (auth instanceof NextResponse) return auth;
    logCtx.userId = auth.userId;
    logCtx.keyId = auth.keyId;

    const scopeError = requireScope(auth, "participant-projects:write");
    if (scopeError) return scopeError;

    const resolvedAuth = await resolveAgentPathEvent(auth, eventRef);
    if (resolvedAuth instanceof NextResponse) return resolvedAuth;
    logCtx.eventId = resolvedAuth.eventId;

    const access = await authorizeAgentEventAccess(resolvedAuth, EventRole.Participant);
    if (access instanceof NextResponse) return access;

    const { data: profile, error: profileError } = await fetchAgentUserProfile(
      resolvedAuth.userId
    );

    if (profileError || !profile?.email) {
      logAgentEvent("participant_projects_submit_profile_missing", logCtx, profileError);
      return NextResponse.json(
        { error: "User email not found" },
        { status: 400 }
      );
    }

    const bodyResult = await safeJsonBody(request, logCtx);
    if (!bodyResult.ok) return bodyResult.response;
    const body = bodyResult.body as Record<string, unknown> | null | undefined;

    const parsed = normalizeProjectWriteInput({
      ...(body ?? {}),
      eventId: resolvedAuth.eventId,
      leadEmail:
        (body as { leadEmail?: string })?.leadEmail ??
        (body as { lead_email?: string })?.lead_email ??
        profile.email,
      leadName:
        (body as { leadName?: string })?.leadName ??
        (body as { lead_name?: string })?.lead_name ??
        profile.display_name ??
        undefined,
    });

    if (!parsed.success) {
      logAgentEvent(
        "participant_projects_submit_validation_failed",
        { ...logCtx, status: 400 },
        parsed.error
      );
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (parsed.data.projectId) {
      logAgentEvent("participant_projects_submit_rejected_project_id", {
        ...logCtx,
        status: 400,
      });
      return NextResponse.json(
        { error: "Use PATCH on the project route to edit an existing project" },
        { status: 400 }
      );
    }

    const result = await saveProjectSubmission(createSupabaseServiceClient(), {
      input: {
        ...parsed.data,
        eventId: resolvedAuth.eventId,
      },
      mode: "create",
      defaultSubmitted: true,
    });

    if ("error" in result) {
      logAgentEvent(
        "participant_projects_submit_service_error",
        { ...logCtx, status: result.status },
        result.error
      );
      return NextResponse.json(
        Object.fromEntries(
          Object.entries(result).filter(([key]) => !["status"].includes(key))
        ),
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      project: result.project,
    });
  } catch (error) {
    logAgentEvent("participant_projects_submit_crashed", logCtx, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
