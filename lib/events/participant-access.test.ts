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

  describe("paid events on the web channel", () => {
    const buildSupabase = ({
      requireApproval = false,
      approvalRequest = null,
      payment = null,
      ticket = null,
      paymentError = null,
      ticketError = null,
    }: {
      requireApproval?: boolean;
      approvalRequest?: { id: string; status: string } | null;
      payment?: { payment_status: string } | null;
      ticket?: { id: string } | null;
      paymentError?: unknown;
      ticketError?: unknown;
    }) => {
      const upsert = jest.fn().mockResolvedValue({ error: null });
      const insert = jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            overrideTypes: jest.fn().mockResolvedValue({
              data: { id: "request-1" },
              error: null,
            }),
          })),
        })),
      }));

      const results: Record<string, { data: unknown; error: unknown }> = {
        events: {
          data: {
            event_id: "event-1",
            event_name: "Paid Event",
            visibility: "public",
            approval_status: "approved",
            require_participant_approval: requireApproval,
            participant_capacity: null,
            paid: true,
          },
          error: null,
        },
        user_event_roles: { data: null, error: null },
        event_intake_form_bindings: { data: null, error: null },
        participant_approval_requests: { data: approvalRequest, error: null },
        user_event_payments: { data: payment, error: paymentError },
        event_tickets: { data: ticket, error: ticketError },
      };

      const from = jest.fn((table: string) => {
        if (!(table in results)) {
          throw new Error(`Unexpected table ${table}`);
        }

        const query: Record<string, jest.Mock> = {
          select: jest.fn(() => query),
          eq: jest.fn(() => query),
          order: jest.fn(() => query),
          limit: jest.fn(() => query),
          maybeSingle: jest.fn(() => maybeSingleResult(results[table])),
          upsert,
          insert,
        };

        return query;
      });

      return {
        supabase: { from } as unknown as ServiceSupabaseClient,
        from,
        upsert,
        insert,
      };
    };

    const join = (supabase: ServiceSupabaseClient) =>
      joinParticipantEvent(supabase, {
        eventId: "event-1",
        userId: "user-1",
        channel: "web",
      });

    it("refuses a join with no payment and no ticket", async () => {
      const { supabase, upsert } = buildSupabase({});

      const result = await join(supabase);

      expect(result).toMatchObject({ status: "error", httpStatus: 402 });
      expect(upsert).not.toHaveBeenCalled();
    });

    it("joins with a paid payment row", async () => {
      const { supabase, upsert } = buildSupabase({
        payment: { payment_status: "paid" },
      });

      const result = await join(supabase);

      expect(result).toMatchObject({ status: "joined" });
      expect(upsert).toHaveBeenCalled();
    });

    it("joins a bundle claimant who has a ticket but no payment row", async () => {
      const { supabase, upsert } = buildSupabase({ ticket: { id: "ticket-1" } });

      const result = await join(supabase);

      expect(result).toMatchObject({ status: "joined" });
      expect(upsert).toHaveBeenCalled();
    });

    it.each([
      ["payment", { paymentError: new Error("boom") }],
      ["ticket", { ticketError: new Error("boom") }],
    ])("fails closed when the %s lookup errors", async (_name, errors) => {
      const { supabase, upsert } = buildSupabase(errors);

      const result = await join(supabase);

      expect(result).toEqual({
        status: "error",
        httpStatus: 500,
        payload: { error: "Failed to verify payment status" },
      });
      expect(upsert).not.toHaveBeenCalled();
    });

    it("still asks for approval before payment on approval events", async () => {
      const { supabase, insert, upsert } = buildSupabase({
        requireApproval: true,
      });

      const result = await join(supabase);

      expect(result).toMatchObject({ status: "approval_requested" });
      expect(insert).toHaveBeenCalled();
      expect(upsert).not.toHaveBeenCalled();
    });

    it("keeps the approved-but-unpaid response on approval events", async () => {
      const { supabase, upsert } = buildSupabase({
        requireApproval: true,
        approvalRequest: { id: "request-1", status: "approved" },
      });

      const result = await join(supabase);

      expect(result).toEqual({
        status: "error",
        httpStatus: 402,
        payload: {
          error:
            "Payment required. Your request has been approved, but payment is still needed.",
          requires_approval: false,
          request_status: "approved_pending_payment",
        },
      });
      expect(upsert).not.toHaveBeenCalled();
    });

    it("joins an approved ticket holder on an approval event", async () => {
      const { supabase, upsert } = buildSupabase({
        requireApproval: true,
        approvalRequest: { id: "request-1", status: "approved" },
        ticket: { id: "ticket-1" },
      });

      const result = await join(supabase);

      expect(result).toMatchObject({ status: "joined" });
      expect(upsert).toHaveBeenCalled();
    });
  });
});
