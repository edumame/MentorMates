import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { listJoinableParticipantAgentEvents } from "./event-access";

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

type Rows = Record<string, unknown>[];

// Thenable query stub: every filter returns itself, awaiting yields the rows.
function query(rows: Rows, error: unknown = null) {
  const result = { data: rows, error };
  const chain = {
    select: jest.fn((): unknown => chain),
    eq: jest.fn((): unknown => chain),
    or: jest.fn((): unknown => chain),
    in: jest.fn((): unknown => chain),
    order: jest.fn((): unknown => chain),
    range: jest.fn((): unknown => chain),
    then: (resolve: (value: typeof result) => unknown) => resolve(result),
  };
  return chain;
}

describe("listJoinableParticipantAgentEvents", () => {
  const event = (event_id: string) => ({
    event_id,
    event_name: event_id,
    event_date: "2026-11-04",
    visibility: "public",
    approval_status: "approved",
    participant_capacity: null,
    paid: false,
  });

  const mockTables = (
    rolePasswords: ReturnType<typeof query>,
  ): void => {
    (createSupabaseServiceClient as jest.Mock).mockReturnValue({
      from: jest.fn((table: string) => {
        switch (table) {
          case "events":
            return query([event("open-event"), event("locked-event")]);
          case "user_event_roles":
          case "event_intake_form_bindings":
          case "intake_form_submissions":
            return query([]);
          case "role_passwords":
            return rolePasswords;
          default:
            throw new Error(`Unexpected table ${table}`);
        }
      }),
    });
  };

  it("omits events whose participant role has a password", async () => {
    const rolePasswords = query([{ event_id: "locked-event" }]);
    mockTables(rolePasswords);

    const events = await listJoinableParticipantAgentEvents("user-1");

    expect(events.map((row) => row.event_id)).toEqual(["open-event"]);
    expect(rolePasswords.eq).toHaveBeenCalledWith("role", "participant");
  });

  it("throws when the role password lookup fails", async () => {
    const lookupError = new Error("boom");
    mockTables(query([], lookupError));

    await expect(
      listJoinableParticipantAgentEvents("user-1"),
    ).rejects.toBe(lookupError);
  });
});
