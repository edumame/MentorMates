/**
 * @jest-environment node
 */
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { generateEventRoleInviteToken } from "@/lib/utils/jwt";
import { consumeInvite, getPendingInvite, issueEventRoleInviteToken } from "./role-invitations";

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: jest.fn() }));

const EVENT = "11111111-1111-4111-8111-111111111111";
const future = () => new Date(Date.now() + 3600_000).toISOString();

function db(row: Record<string, unknown> | null, updated: unknown[] = [{ id: "inv-1" }]) {
  const calls: unknown[][] = [];
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "is", "gt", "update"]) {
    chain[m] = (...args: unknown[]) => {
      calls.push([m, ...args]);
      return chain;
    };
  }
  chain.insert = (values: unknown) => {
    calls.push(["insert", values]);
    return { select: () => ({ single: async () => ({ data: { id: "inv-1" }, error: null }) }) };
  };
  chain.maybeSingle = async () => ({ data: row, error: null });
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: updated, error: null }).then(resolve);
  jest.mocked(createSupabaseServiceClient).mockReturnValue({ from: () => chain } as never);
  return calls;
}

const pendingRow = (overrides: Record<string, unknown> = {}) => ({
  id: "inv-1", event_id: EVENT, email: "a@example.test", role: "organizer",
  expires_at: future(), accepted_at: null, revoked_at: null, ...overrides,
});

describe("role invitations (ORG-012 round 2)", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = "role-invitations-test-secret";
  });

  it("issues a token bound to a stored row that expires within 7 days", async () => {
    const calls = db(null);
    const token = await issueEventRoleInviteToken({ email: " A@Example.test ", eventId: EVENT, role: "organizer" });
    const insert = calls.find((c) => c[0] === "insert")![1] as { email: string; expires_at: string };
    expect(insert.email).toBe("a@example.test");
    expect(Date.parse(insert.expires_at) - Date.now()).toBeLessThanOrEqual(7 * 24 * 3600_000);
    db(pendingRow());
    await expect(getPendingInvite(token)).resolves.toEqual({ email: "a@example.test", eventId: EVENT, role: "organizer", jti: "inv-1" });
  });

  it("rejects legacy tokens without a stored row id", async () => {
    db(pendingRow());
    const legacy = await generateEventRoleInviteToken({ email: "a@example.test", eventId: EVENT, role: "organizer" });
    await expect(getPendingInvite(legacy)).resolves.toBeNull();
  });

  it.each([
    ["accepted", { accepted_at: new Date().toISOString() }],
    ["revoked", { revoked_at: new Date().toISOString() }],
    ["expired", { expires_at: new Date(Date.now() - 1000).toISOString() }],
    ["for another email", { email: "b@example.test" }],
    ["for another role", { role: "judge" }],
    ["for another event", { event_id: "22222222-2222-4222-8222-222222222222" }],
  ])("rejects an invitation that is %s", async (_label, overrides) => {
    const token = await generateEventRoleInviteToken({ email: "a@example.test", eventId: EVENT, role: "organizer", jti: "inv-1" });
    db(pendingRow(overrides));
    await expect(getPendingInvite(token)).resolves.toBeNull();
  });

  it("rejects a missing row and empty tokens", async () => {
    const token = await generateEventRoleInviteToken({ email: "a@example.test", eventId: EVENT, role: "organizer", jti: "inv-1" });
    db(null);
    await expect(getPendingInvite(token)).resolves.toBeNull();
    await expect(getPendingInvite("")).resolves.toBeNull();
  });

  it("consumes only a pending, unexpired row", async () => {
    let calls = db(null, [{ id: "inv-1" }]);
    await expect(consumeInvite("inv-1", "user-1")).resolves.toBe(true);
    expect(calls).toEqual(expect.arrayContaining([["is", "accepted_at", null], ["is", "revoked_at", null]]));
    calls = db(null, []);
    await expect(consumeInvite("inv-1", "user-1")).resolves.toBe(false);
  });
});
