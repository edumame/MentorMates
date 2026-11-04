/** @jest-environment node */
import { GET } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));
jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));
jest.mock("@/lib/events/invite-emails", () => ({
  sendEventInviteEmails: jest.fn(),
  sendOrganizerInviteEmails: jest.fn(),
}));

const EVENT_ROW = {
  event_id: "event-1",
  event_name: "Listed Event",
  slug: "listed-event",
  event_date: "2026-12-01",
  location: "Online",
  visibility: "public",
  featured: true,
  paywall_content: "SECRET participant-only content",
  submitter_email: "submitter@example.com",
  submitter_name: "Sample Submitter",
  organizer_affiliation: "Sample University",
};

/** Honours the requested column list, as PostgREST does. */
function project(row: Record<string, unknown>, columns: string) {
  if (columns === "*") return row;
  const names = columns.split(",").map((column) => column.trim());
  return Object.fromEntries(
    Object.entries(row).filter(([column]) => names.includes(column))
  );
}

function makeSupabase({ isAdmin }: { isAdmin: boolean }) {
  const makeQuery = (table: string) => {
    let columns = "";
    const query = {
      select: (requested: string) => {
        columns = requested;
        return query;
      },
      eq: () => query,
      in: () => query,
      or: () => query,
      then: (resolve: (value: unknown) => unknown) =>
        resolve(
          table === "events"
            ? { data: [project(EVENT_ROW, columns)], error: null }
            : { data: [], error: null }
        ),
    };
    return query;
  };

  return {
    from: jest.fn(makeQuery),
    rpc: jest.fn(async () => ({ data: isAdmin })),
    auth: {
      getUser: jest.fn(async () => ({ data: { user: { id: "user-1" } } })),
    },
  };
}

describe("GET /api/events", () => {
  it.each([
    ["regular users", false],
    ["admins", true],
  ])("returns only display columns to signed-in %s", async (_label, isAdmin) => {
    (createSupabaseClient as jest.Mock).mockResolvedValue(
      makeSupabase({ isAdmin })
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({
      event_id: "event-1",
      event_name: "Listed Event",
      slug: "listed-event",
      visibility: "public",
      featured: true,
      userRole: null,
    });
    for (const column of [
      "paywall_content",
      "submitter_email",
      "submitter_name",
      "organizer_affiliation",
    ]) {
      expect(body.events[0]).not.toHaveProperty(column);
    }
  });
});
