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

        if (table === "role_passwords") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                })),
              })),
            })),
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

  describe("agent join gates", () => {
    const publicEvent = {
      event_id: "event-1",
      event_name: "Gated Event",
      visibility: "public",
      approval_status: "approved",
      require_participant_approval: false,
      participant_capacity: null,
      paid: false,
    };

    const buildClient = ({
      event = publicEvent,
      existingRole = null,
      rolePassword = { data: null, error: null },
    }: {
      event?: Record<string, unknown>;
      existingRole?: { role: string } | null;
      rolePassword?: { data: unknown; error: unknown };
    }) => {
      const upsert = jest.fn().mockResolvedValue({ error: null });
      const rolePasswordEq = jest.fn();
      const single = (result: { data: unknown; error: unknown }) => ({
        maybeSingle: jest.fn(() => maybeSingleResult(result)),
      });

      const supabase = {
        from: jest.fn((table: string) => {
          if (table === "events") {
            return {
              select: jest.fn(() => ({
                eq: jest.fn(() => single({ data: event, error: null })),
              })),
            };
          }

          if (table === "user_event_roles") {
            return {
              select: jest.fn(() => ({
                eq: jest.fn(() => ({
                  eq: jest.fn(() =>
                    single({ data: existingRole, error: null }),
                  ),
                })),
              })),
              upsert,
            };
          }

          if (table === "role_passwords") {
            const chain = {
              eq: rolePasswordEq.mockImplementation((): unknown => chain),
              maybeSingle: jest.fn().mockResolvedValue(rolePassword),
            };
            return { select: jest.fn(() => chain) };
          }

          if (table === "event_intake_form_bindings") {
            const chain = {
              eq: jest.fn((): unknown => chain),
              order: jest.fn((): unknown => chain),
              limit: jest.fn((): unknown => chain),
              maybeSingle: jest.fn(() =>
                maybeSingleResult({ data: null, error: null }),
              ),
            };
            return { select: jest.fn(() => chain) };
          }

          throw new Error(`Unexpected table ${table}`);
        }),
      } as unknown as ServiceSupabaseClient;

      return { supabase, upsert, rolePasswordEq };
    };

    const join = (
      supabase: ServiceSupabaseClient,
      channel: "web" | "agent" = "agent",
    ) =>
      joinParticipantEvent(supabase, {
        eventId: "event-1",
        userId: "user-1",
        channel,
      });

    it.each(["draft", "private", "test", "demo", "archived", null])(
      "blocks agent joins when visibility is %s",
      async (visibility) => {
        const { supabase, upsert } = buildClient({
          event: { ...publicEvent, visibility },
        });

        const result = await join(supabase);

        expect(result).toEqual({
          status: "error",
          httpStatus: 403,
          payload: {
            error:
              "Only public, approved events can be joined through the agent API.",
          },
        });
        expect(upsert).not.toHaveBeenCalled();
      },
    );

    it.each(["not_submitted", "submitted", "rejected", null])(
      "blocks agent joins when approval_status is %s",
      async (approval_status) => {
        const { supabase, upsert } = buildClient({
          event: { ...publicEvent, approval_status },
        });

        const result = await join(supabase);

        expect(result).toMatchObject({ status: "error", httpStatus: 403 });
        expect(upsert).not.toHaveBeenCalled();
      },
    );

    it("blocks agent joins when the participant role has a password", async () => {
      const { supabase, upsert, rolePasswordEq } = buildClient({
        rolePassword: { data: { event_id: "event-1" }, error: null },
      });

      const result = await join(supabase);

      expect(result).toEqual({
        status: "error",
        httpStatus: 403,
        payload: {
          error:
            "Password-protected events cannot be joined through the agent API.",
        },
      });
      expect(rolePasswordEq).toHaveBeenCalledWith("event_id", "event-1");
      expect(rolePasswordEq).toHaveBeenCalledWith("role", "participant");
      expect(upsert).not.toHaveBeenCalled();
    });

    it("fails closed when the role password lookup errors", async () => {
      const { supabase, upsert } = buildClient({
        rolePassword: { data: null, error: { message: "boom" } },
      });

      const result = await join(supabase);

      expect(result).toEqual({
        status: "error",
        httpStatus: 500,
        payload: { error: "Failed to verify role password" },
      });
      expect(upsert).not.toHaveBeenCalled();
    });

    it("still reports an existing role as a conflict on a gated event", async () => {
      const { supabase } = buildClient({
        event: { ...publicEvent, visibility: "private" },
        existingRole: { role: "participant" },
      });

      const result = await join(supabase);

      expect(result).toEqual({
        status: "error",
        httpStatus: 409,
        payload: { error: "You already have a role in this event" },
      });
    });

    it("leaves web joins to the verify route's own gates", async () => {
      const { supabase, upsert } = buildClient({
        event: { ...publicEvent, visibility: "private" },
        rolePassword: { data: { event_id: "event-1" }, error: null },
      });

      const result = await join(supabase, "web");

      expect(result).toMatchObject({ status: "joined" });
      expect(upsert).toHaveBeenCalled();
    });
  });
});
