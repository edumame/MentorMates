import { NextRequest, NextResponse } from "next/server";
import {
  authenticateAgentRequest,
  authorizeAgentEventAccess,
  requireScope,
} from "@/lib/agent/auth";
import {
  listJoinableParticipantAgentEvents,
  listParticipantAgentEvents,
  toParticipantAgentEvent,
} from "@/lib/agent/event-access";
import { logAgentEvent } from "@/lib/agent/logging";
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

    const filteredJoined = auth.eventId
      ? joinedEvents.filter((event) => event.event_id === auth.eventId)
      : joinedEvents;
    const filteredJoinable = auth.eventId ? [] : joinableEvents;

    return NextResponse.json({
      joined_events: filteredJoined.map(toParticipantAgentEvent),
      joinable_events: filteredJoinable.map(toParticipantAgentEvent),
    });
  } catch (error) {
    logAgentEvent(
      "participant_events_list_crashed",
      { route: "GET /api/agent/me/events" },
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
