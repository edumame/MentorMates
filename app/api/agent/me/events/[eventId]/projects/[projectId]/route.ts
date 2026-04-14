import { NextRequest, NextResponse } from "next/server";
import {
  authenticateAgentRequest,
  authorizeAgentEventAccess,
  requireScope,
  resolveAgentPathEvent,
} from "@/lib/agent/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EventRole } from "@/lib/types";
import { getProjectEditAccess } from "@/lib/projects/access";
import {
  normalizeProjectWriteInput,
  saveProjectSubmission,
} from "@/lib/projects/submission-service";

async function fetchAgentUserEmail(userId: string) {
  const supabase = createSupabaseServiceClient();
  return supabase
    .from("user_profiles")
    .select("email")
    .eq("uid", userId)
    .maybeSingle();
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ eventId: string; projectId: string }> }
) {
  try {
    const { eventId, projectId } = await context.params;
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

    const { data: profile, error: profileError } = await fetchAgentUserEmail(
      resolvedAuth.userId
    );

    if (profileError || !profile?.email) {
      return NextResponse.json(
        { error: "User email not found" },
        { status: 400 }
      );
    }

    const editAccessResult = await getProjectEditAccess(createSupabaseServiceClient(), {
      projectId,
      userId: resolvedAuth.userId,
      userEmail: profile.email,
      allowOrganizer: false,
    });

    if (!editAccessResult.access) {
      return NextResponse.json(
        { error: editAccessResult.error },
        { status: editAccessResult.status }
      );
    }

    if (!editAccessResult.access.canEdit || editAccessResult.access.eventId !== resolvedAuth.eventId) {
      return NextResponse.json(
        { error: "Unauthorized to edit this project" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = normalizeProjectWriteInput({
      ...body,
      eventId: resolvedAuth.eventId,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await saveProjectSubmission(createSupabaseServiceClient(), {
      input: {
        ...parsed.data,
        eventId: resolvedAuth.eventId,
      },
      mode: "update",
      projectId,
    });

    if ("error" in result) {
      return NextResponse.json(
        Object.fromEntries(
          Object.entries(result).filter(([key]) => !["status"].includes(key))
        ),
        { status: result.status }
      );
    }

    if ("message" in result) {
      return NextResponse.json({ message: result.message });
    }

    return NextResponse.json({
      success: true,
      project: result.project,
    });
  } catch (error) {
    console.error("Participant agent project PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
