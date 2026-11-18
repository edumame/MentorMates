/** @jest-environment node */
import { NextRequest } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { queryMock, supabaseMock } from "@/lib/testing/supabase-query-mock";
import { EventRole } from "@/lib/types";
import { PATCH } from "./route";

jest.mock("@/app/utils/supabase/server", () => ({ createSupabaseClient: jest.fn() }));
jest.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: jest.fn() }));

const ctx = { params: Promise.resolve({ eventId: "evt", requestId: "req" }) };
const patch = (status: string) =>
  PATCH(new NextRequest("http://localhost/x", { method: "PATCH", body: JSON.stringify({ status }) }), ctx);

function setup(requestedRole: EventRole) {
  const request = queryMock({ data: { id: "req", event_id: "evt", user_id: "u", requested_role: requestedRole, status: "pending" }, error: null });
  const updates = queryMock({ data: null, error: null });
  const roles = queryMock({ data: null, error: null });
  (createSupabaseClient as jest.Mock).mockResolvedValue(supabaseMock({
    user: { id: "org" },
    rpcResults: { is_admin_user: { data: false } },
    tables: {
      user_event_roles: [queryMock({ data: { role: EventRole.Organizer }, error: null }), roles],
      participant_approval_requests: [request, updates],
      events: queryMock({ data: { participant_capacity: null, paid: false }, error: null }),
    },
  }));
  // Capacity is checked with the service client (isParticipantSeatAvailable).
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(supabaseMock({
    tables: {
      events: queryMock({ data: { participant_capacity: null, paid: false }, error: null }),
    },
  }));
  return { updates, roles };
}

describe("PATCH approval request (ORG-017)", () => {
  it.each([EventRole.Organizer, EventRole.Judge, EventRole.Mentor, EventRole.Admin])(
    "refuses to approve a %s request and grants nothing",
    async (role) => {
      const { updates, roles } = setup(role);
      const res = await patch("approved");
      expect(res.status).toBe(400);
      expect(updates.update).not.toHaveBeenCalled();
      expect(roles.insert).not.toHaveBeenCalled();
    }
  );

  it("still allows rejecting a staff-role request", async () => {
    const { updates } = setup(EventRole.Organizer);
    const res = await patch("rejected");
    expect(res.status).toBe(200);
    expect(updates.update).toHaveBeenCalledWith(expect.objectContaining({ status: "rejected" }));
  });

  it("approves participant requests and inserts the participant role", async () => {
    const { roles } = setup(EventRole.Participant);
    const res = await patch("approved");
    expect(res.status).toBe(200);
    expect(roles.insert).toHaveBeenCalledWith(expect.objectContaining({ role: EventRole.Participant }));
  });
});
