/** @jest-environment node */
import { TRPCError } from "@trpc/server";

// React's server-only `cache` export is absent from the build Jest resolves.
jest.mock("react", () => ({
  ...jest.requireActual("react"),
  cache: (fn: unknown) => fn,
}));

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
  createSupabaseServiceClient: jest.fn(),
}));

import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createCallerFactory } from "@/trpc/init";
import { agentsRouter } from "./procedures";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "22222222-2222-4222-8222-222222222222";
const agentInput = { name: "Pitch coach", instructions: "Coach pitches", type: "brainstorm" };

function maybeSingleResult(data: unknown) {
  const query: Record<string, jest.Mock> = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    in: jest.fn(() => query),
    maybeSingle: jest.fn(async () => ({ data, error: null })),
  };
  return query;
}

function setupSupabase({
  isAdmin = false,
  adminError = null,
  eventOwnerId = null,
  eventRole = null,
}: {
  isAdmin?: boolean;
  adminError?: Error | null;
  eventOwnerId?: string | null;
  eventRole?: string | null;
} = {}) {
  const insert = jest.fn((payload: Record<string, unknown>) => ({
    select: jest.fn(async () => ({ data: [{ id: "agent-1", ...payload }], error: null })),
  }));
  const client = {
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: USER_ID } } })) },
    rpc: jest.fn(async () => ({ data: adminError ? null : isAdmin, error: adminError })),
    from: jest.fn((table: string) => {
      if (table === "agents") return { insert };
      if (table === "events") return maybeSingleResult({ owner_id: eventOwnerId });
      if (table === "user_event_roles") return maybeSingleResult(eventRole ? { role: eventRole } : null);
      throw new Error(`Unexpected table ${table}`);
    }),
  };
  (createSupabaseClient as jest.Mock).mockResolvedValue(client);
  return { client, insert };
}

const caller = () =>
  createCallerFactory(agentsRouter)({ userId: USER_ID } as Parameters<
    ReturnType<typeof createCallerFactory>
  >[0]);

describe("agents.create authorization", () => {
  it.each([
    ["omitted", agentInput],
    ["empty", { ...agentInput, event_id: "" }],
  ])("rejects a non-admin creating a global agent when event_id is %s", async (_label, input) => {
    const { insert } = setupSupabase();

    const error = await caller().create(input).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TRPCError);
    expect((error as TRPCError).code).toBe("FORBIDDEN");
    expect(insert).not.toHaveBeenCalled();
  });

  it("does not insert a global agent when the admin check fails", async () => {
    const adminError = new Error("rpc unavailable");
    const { insert } = setupSupabase({ adminError });

    await expect(caller().create(agentInput)).rejects.toThrow("rpc unavailable");
    expect(insert).not.toHaveBeenCalled();
  });

  it("lets a platform admin create a global agent", async () => {
    const { insert } = setupSupabase({ isAdmin: true });

    await expect(caller().create(agentInput)).resolves.toMatchObject({ id: "agent-1" });
    expect(insert).toHaveBeenCalledWith({ ...agentInput, user_id: USER_ID });
  });

  it.each([
    ["organizer role", { eventRole: "organizer" }],
    ["event ownership", { eventOwnerId: USER_ID }],
  ])("lets a non-admin create an event agent through %s", async (_label, access) => {
    const { insert } = setupSupabase(access);

    await caller().create({ ...agentInput, event_id: EVENT_ID });

    expect(insert).toHaveBeenCalledWith({ ...agentInput, event_id: EVENT_ID, user_id: USER_ID });
  });

  it("rejects a user who cannot manage the event", async () => {
    const { insert } = setupSupabase();

    await expect(caller().create({ ...agentInput, event_id: EVENT_ID })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(insert).not.toHaveBeenCalled();
  });
});
