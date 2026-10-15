/** @jest-environment node */

import { NextRequest } from "next/server";
import { GET } from "./route";
import {
  authenticateAgentRequest,
  authorizeAgentEventAccess,
  requireScope,
} from "@/lib/agent/auth";
import {
  listJoinableParticipantAgentEvents,
  listParticipantAgentEvents,
} from "@/lib/agent/event-access";

jest.mock("@/lib/agent/auth", () => ({
  authenticateAgentRequest: jest.fn(),
  authorizeAgentEventAccess: jest.fn(),
  requireScope: jest.fn(),
}));

jest.mock("@/lib/agent/event-access", () => ({
  ...jest.requireActual("@/lib/agent/event-access"),
  listParticipantAgentEvents: jest.fn(),
  listJoinableParticipantAgentEvents: jest.fn(),
}));

describe("GET /api/agent/me/events", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireScope as jest.Mock).mockReturnValue(null);
  });

  it("returns joined and joinable participant events for reusable keys", async () => {
    (authenticateAgentRequest as jest.Mock).mockResolvedValue({
      userId: "user-1",
      eventId: "",
      scopes: ["participant-events:read"],
      keyId: "key-1",
    });
    (listParticipantAgentEvents as jest.Mock).mockResolvedValue([
      { event_id: "event-1", event_name: "Joined Event", approval_status: "approved", participant_capacity: 42 },
    ]);
    (listJoinableParticipantAgentEvents as jest.Mock).mockResolvedValue([
      { event_id: "event-2", event_name: "Joinable Event" },
    ]);

    const response = await GET(new NextRequest("https://mentormates.ai/api/agent/me/events"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      joined_events: [{ event_id: "event-1", event_name: "Joined Event" }],
      joinable_events: [{ event_id: "event-2", event_name: "Joinable Event" }],
    });
    expect(authorizeAgentEventAccess).not.toHaveBeenCalled();
  });
});
