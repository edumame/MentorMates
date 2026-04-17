import { NextRequest, NextResponse } from "next/server";
import {
  authenticateAgentRequest,
  authorizeAgentEventAccess,
  requireScope,
  resolveAgentPathEvent,
} from "@/lib/agent/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EventRole } from "@/lib/types";
import { listParticipantProjectsByEvent } from "@/lib/projects/participant-projects";
import {
  normalizeProjectWriteInput,
  saveProjectSubmission,
} from "@/lib/projects/submission-service";

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
  try {
    const { eventId } = await context.params;
    const auth = await authenticateAgentRequest(request, {
      allowMissingEventId: true,
    });
    if (auth instanceof NextResponse) return auth;

    const scopeError = requireScope(auth, "participant-projects:read");
    if (scopeError) return scopeError;

    const resolvedAuth = await resolveAgentPathEvent(auth, eventId);
    if (resolvedAuth instanceof NextResponse) return resolvedAuth;

    const access = await authorizeAgentEventAccess(resolvedAuth, EventRole.Participant);
    if (access instanceof NextResponse) return access;

    const { data: profile, error: profileError } = await fetchAgentUserProfile(
      resolvedAuth.userId
    );

    if (profileError || !profile?.email) {
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
    console.error("Participant agent projects GET error:", error);
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
  try {
    const { eventId } = await context.params;
    const auth = await authenticateAgentRequest(request, {
      allowMissingEventId: true,
    });
    if (auth instanceof NextResponse) return auth;

    const scopeError = requireScope(auth, "participant-projects:write");
    if (scopeError) return scopeError;

    const resolvedAuth = await resolveAgentPathEvent(auth, eventId);
    if (resolvedAuth instanceof NextResponse) return resolvedAuth;

    const access = await authorizeAgentEventAccess(resolvedAuth, EventRole.Participant);
    if (access instanceof NextResponse) return access;

    const { data: profile, error: profileError } = await fetchAgentUserProfile(
      resolvedAuth.userId
    );

    if (profileError || !profile?.email) {
      return NextResponse.json(
        { error: "User email not found" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = normalizeProjectWriteInput({
      ...body,
      eventId: resolvedAuth.eventId,
      leadEmail: body?.leadEmail ?? body?.lead_email ?? profile.email,
      leadName: body?.leadName ?? body?.lead_name ?? profile.display_name ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (parsed.data.projectId) {
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
    console.error("Participant agent projects POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
