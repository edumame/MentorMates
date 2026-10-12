import { NextRequest, NextResponse } from "next/server";
import {
  authenticateAgentRequest,
  requireScope,
  resolveAgentPathEvent,
} from "@/lib/agent/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { logAgentEvent } from "@/lib/agent/logging";
import { joinParticipantEvent } from "@/lib/events/participant-access";

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

    const scopeError = requireScope(auth, "participant-events:join");
    if (scopeError) return scopeError;

    const resolvedAuth = await resolveAgentPathEvent(auth, eventId);
    if (resolvedAuth instanceof NextResponse) return resolvedAuth;

    const result = await joinParticipantEvent(createSupabaseServiceClient(), {
      eventId: resolvedAuth.eventId,
      userId: resolvedAuth.userId,
      channel: "agent",
    });

    if (result.status === "error") {
      return NextResponse.json(result.payload, { status: result.httpStatus });
    }

    return NextResponse.json({
      success: true,
      requires_approval: result.requiresApproval,
      request_id: result.requestId,
      request_status: result.requestStatus,
      message: result.message,
    });
  } catch (error) {
    logAgentEvent(
      "participant_join_crashed",
      { route: "POST /api/agent/me/events/[eventId]/join" },
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
