import type { ServiceSupabaseClient } from "@/lib/supabase/service";
import { joinParticipantEvent } from "./participant-access";

describe("joinParticipantEvent", () => {
  const maybeSingleResult = (result: { data: unknown; error: unknown }) => ({
    overrideTypes: jest.fn().mockResolvedValue(result),
  });

  it("blocks paid events for agent joins", async () => {
    const supabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() =>
              maybeSingleResult({
                data: {
                  event_id: "event-1",
                  event_name: "Paid Event",
                  visibility: "public",
                  approval_status: "approved",
                  require_participant_approval: false,
                  participant_capacity: null,
                  paid: true,
                },
                error: null,
              }),
            ),
          })),
        })),
      })),
    } as unknown as ServiceSupabaseClient;

    const result = await joinParticipantEvent(
      supabase,
      {
        eventId: "event-1",
        userId: "user-1",
        channel: "agent",
      }
    );

    expect(result).toEqual({
      status: "error",
      httpStatus: 403,
      payload: {
        error: "Paid events cannot be joined through the agent API.",
      },
    });
  });

  it("joins an unpaid public event without approval", async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "events") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                maybeSingle: jest.fn(() =>
                  maybeSingleResult({
                    data: {
                      event_id: "event-1",
                      event_name: "Free Event",
                      visibility: "public",
                      approval_status: "approved",
                      require_participant_approval: false,
                      participant_capacity: null,
                      paid: false,
                    },
                    error: null,
                  }),
                ),
              })),
            })),
          };
        }

        if (table === "user_event_roles") {
          return {
            select: jest.fn((columns: string) => {
              if (columns === "role") {
                return {
                  eq: jest.fn(() => ({
                    eq: jest.fn(() => ({
                      maybeSingle: jest.fn(() =>
                        maybeSingleResult({
                          data: null,
                          error: null,
                        }),
                      ),
                    })),
                  })),
                };
              }

              return {
                eq: jest.fn(() => ({
                  eq: jest.fn().mockResolvedValue({
                    count: 0,
                    error: null,
                  }),
                })),
              };
            }),
            upsert,
          };
        }

        if (table === "event_intake_form_bindings") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    order: jest.fn(() => ({
                      limit: jest.fn(() => ({
                        maybeSingle: jest.fn(() =>
                          maybeSingleResult({
                            data: null,
                            error: null,
                          }),
                        ),
                      })),
                    })),
                  })),
                })),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    } as unknown as ServiceSupabaseClient;

    const result = await joinParticipantEvent(
      supabase,
      {
        eventId: "event-1",
        userId: "user-1",
        channel: "agent",
      }
    );

    expect(result).toEqual({
      status: "joined",
      requiresApproval: false,
      requestStatus: "joined",
      message: "Joined Free Event as a participant",
    });
    expect(upsert).toHaveBeenCalled();
  });
});
