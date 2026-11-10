import { listJoinableParticipantAgentEvents } from "./event-access";
import { createCappedQuery } from "@/lib/supabase/capped-query.test-helper";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

function mockTables({
  events,
  participants,
}: {
  events: { event_id: string; participant_capacity: number | null }[];
  participants: ReturnType<typeof createCappedQuery>;
}) {
  // The first role query reads the user's own roles; every later one is a page
  // of participant rows.
  let existingRolesRead = false;
  const tables: Record<string, () => unknown> = {
    events: () => createCappedQuery(events),
    user_event_roles: () => {
      if (existingRolesRead) return participants;
      existingRolesRead = true;
      return createCappedQuery([]);
    },
    event_intake_form_bindings: () => createCappedQuery([]),
    intake_form_submissions: () => createCappedQuery([]),
  };

  (createSupabaseServiceClient as jest.Mock).mockReturnValue({
    from: jest.fn((table: string) => tables[table]()),
  });
}

const participantRows = (eventId: string, count: number) =>
  Array.from({ length: count }, () => ({ event_id: eventId }));

describe("listJoinableParticipantAgentEvents", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("excludes a full event whose participants fall past the row cap", async () => {
    mockTables({
      events: [
        { event_id: "open", participant_capacity: 2000 },
        { event_id: "full", participant_capacity: 300 },
      ],
      participants: createCappedQuery([
        ...participantRows("open", 1000),
        ...participantRows("full", 300),
      ]),
    });

    const events = await listJoinableParticipantAgentEvents("user-1");

    expect(events.map((event) => event.event_id)).toEqual(["open"]);
  });

  it("only reads participant rows for events that have a capacity", async () => {
    const participants = createCappedQuery(participantRows("capped", 1));
    mockTables({
      events: [
        { event_id: "uncapped", participant_capacity: null },
        { event_id: "capped", participant_capacity: 10 },
      ],
      participants,
    });

    const events = await listJoinableParticipantAgentEvents("user-1");

    expect(events.map((event) => event.event_id)).toEqual([
      "uncapped",
      "capped",
    ]);
    expect(participants.in).toHaveBeenCalledWith("event_id", ["capped"]);
  });

  it("throws when the participant query fails", async () => {
    const failure = { message: "boom" };
    mockTables({
      events: [{ event_id: "capped", participant_capacity: 10 }],
      participants: createCappedQuery([], { error: failure }),
    });

    await expect(listJoinableParticipantAgentEvents("user-1")).rejects.toBe(
      failure,
    );
  });
});
