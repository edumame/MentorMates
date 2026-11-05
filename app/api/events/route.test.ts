/** @jest-environment node */
import { GET } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

jest.mock("resend", () => ({ Resend: jest.fn() }));

jest.mock("@/lib/events/invite-emails", () => ({
  sendEventInviteEmails: jest.fn(),
  sendOrganizerInviteEmails: jest.fn(),
}));

const mockCreateSupabaseClient = createSupabaseClient as jest.Mock;

const USER_ID = "user-1";
const OWN_EVENT = "11111111-1111-4111-8111-111111111111";
const OWN_EVENT_2 = "22222222-2222-4222-8222-222222222222";

function buildSupabase({
  roles,
  isAdmin = false,
  events = [],
}: {
  roles: Array<{ event_id: string; role: string }>;
  isAdmin?: boolean;
  events?: Array<Record<string, unknown>>;
}) {
  const eventsQuery = {
    select: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    then: (resolve: (value: unknown) => unknown) =>
      resolve({ data: events, error: null }),
  };

  const rolesQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ data: roles, error: null }),
  };

  const supabase = {
    auth: {
      getUser: jest
        .fn()
        .mockResolvedValue({ data: { user: { id: USER_ID } } }),
    },
    rpc: jest.fn().mockResolvedValue({ data: isAdmin }),
    from: jest.fn((table: string) =>
      table === "user_event_roles" ? rolesQuery : eventsQuery
    ),
  };

  mockCreateSupabaseClient.mockResolvedValue(supabase);
  return { eventsQuery };
}

describe("GET /api/events", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("organizer of at least one event", () => {
    it("limits other people's public and private events to approved ones", async () => {
      const { eventsQuery } = buildSupabase({
        roles: [{ event_id: OWN_EVENT, role: "organizer" }],
      });

      const res = await GET();

      expect(res.status).toBe(200);
      expect(eventsQuery.or).toHaveBeenCalledTimes(1);
      const filter = eventsQuery.or.mock.calls[0][0] as string;
      expect(filter).toContain(
        "and(visibility.in.(public,private),approval_status.eq.approved)"
      );
      // A top-level visibility clause would match every approval status.
      expect(filter.startsWith("visibility.in.")).toBe(false);
      expect(filter).not.toContain(",visibility.in.");
    });

    it("keeps the organizer's own events visible in any approval status", async () => {
      const { eventsQuery } = buildSupabase({
        roles: [
          { event_id: OWN_EVENT, role: "organizer" },
          { event_id: OWN_EVENT_2, role: "organizer" },
        ],
      });

      await GET();

      const filter = eventsQuery.or.mock.calls[0][0] as string;
      expect(filter).toContain(
        `and(visibility.in.(public,private,draft,archived),event_id.in.(${OWN_EVENT},${OWN_EVENT_2}))`
      );
    });

    it("does not treat events the user only participates in as their own", async () => {
      const { eventsQuery } = buildSupabase({
        roles: [
          { event_id: OWN_EVENT, role: "organizer" },
          { event_id: OWN_EVENT_2, role: "participant" },
        ],
      });

      await GET();

      const filter = eventsQuery.or.mock.calls[0][0] as string;
      expect(filter).not.toContain(OWN_EVENT_2);
    });

    it("includes the user's role on each returned event", async () => {
      buildSupabase({
        roles: [{ event_id: OWN_EVENT, role: "organizer" }],
        events: [{ event_id: OWN_EVENT }, { event_id: "other" }],
      });

      const res = await GET();
      const body = await res.json();

      expect(body.events).toEqual([
        { event_id: OWN_EVENT, userRole: "organizer" },
        { event_id: "other", userRole: null },
      ]);
    });
  });

  it("restricts regular users to approved public and private events", async () => {
    const { eventsQuery } = buildSupabase({
      roles: [{ event_id: OWN_EVENT, role: "participant" }],
    });

    await GET();

    expect(eventsQuery.or).not.toHaveBeenCalled();
    expect(eventsQuery.in).toHaveBeenCalledWith("visibility", [
      "public",
      "private",
    ]);
    expect(eventsQuery.eq).toHaveBeenCalledWith("approval_status", "approved");
  });

  it("applies no filter for admins, even when they organize an event", async () => {
    const { eventsQuery } = buildSupabase({
      roles: [{ event_id: OWN_EVENT, role: "organizer" }],
      isAdmin: true,
    });

    await GET();

    expect(eventsQuery.or).not.toHaveBeenCalled();
    expect(eventsQuery.in).not.toHaveBeenCalled();
    expect(eventsQuery.eq).not.toHaveBeenCalled();
  });
});
