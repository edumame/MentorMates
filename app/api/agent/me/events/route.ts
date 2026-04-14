import { NextRequest, NextResponse } from "next/server";
import {
  authenticateAgentRequest,
  authorizeAgentEventAccess,
  requireScope,
} from "@/lib/agent/auth";
import {
  listJoinableParticipantAgentEvents,
  listParticipantAgentEvents,
} from "@/lib/agent/event-access";
import { EventRole } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAgentRequest(request, {
      allowMissingEventId: true,
    });
    if (auth instanceof NextResponse) return auth;

    const scopeError = requireScope(auth, "participant-events:read");
    if (scopeError) return scopeError;

    if (auth.eventId) {
      const access = await authorizeAgentEventAccess(auth, EventRole.Participant);
      if (access instanceof NextResponse) return access;
    }

    const [joinedEvents, joinableEvents] = await Promise.all([
      listParticipantAgentEvents(auth.userId),
      auth.eventId ? Promise.resolve([]) : listJoinableParticipantAgentEvents(auth.userId),
    ]);

    return NextResponse.json({
      joined_events: auth.eventId
        ? joinedEvents.filter((event) => event.event_id === auth.eventId)
        : joinedEvents,
      joinable_events: auth.eventId ? [] : joinableEvents,
    });
  } catch (error) {
    console.error("Participant agent events GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
