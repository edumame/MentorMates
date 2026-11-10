/** @jest-environment node */
import * as bcrypt from "bcrypt";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { joinParticipantEvent } from "@/lib/events/participant-access";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EventRole } from "@/lib/types";
import { POST } from "./route";

jest.mock("bcrypt", () => ({ compare: jest.fn() }));
jest.mock("@/app/utils/supabase/server", () => ({ createSupabaseClient: jest.fn() }));
jest.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: jest.fn() }));
jest.mock("@/lib/events/participant-access", () => ({ joinParticipantEvent: jest.fn() }));

const mockCompare = bcrypt.compare as jest.Mock;
const mockJoin = joinParticipantEvent as jest.Mock;

interface Setup {
  existingRole?: EventRole | null;
  passwordHash?: string | null;
  /** Verdicts returned by consume_role_password_attempt, in call order. */
  verdicts?: Array<{ allowed: boolean; retry_at: string | null; scope: string | null }>;
  writeError?: { code?: string } | null;
}

function setup({
  existingRole = null,
  passwordHash = "stored-hash",
  verdicts = [],
  writeError = null,
}: Setup = {}) {
  const insert = jest.fn().mockResolvedValue({ error: writeError });
  const updateChain = {
    eq: jest.fn().mockReturnThis(),
    then: (resolve: (v: unknown) => unknown) => resolve({ error: writeError }),
  };
  const update = jest.fn(() => updateChain);
  const queue = [...verdicts];
  const rpc: jest.Mock = jest.fn((name: string) => {
    if (name === "consume_role_password_attempt") {
      const verdict = queue.length > 1 ? queue.shift()! : queue[0] ?? { allowed: true, retry_at: null, scope: null };
      return Promise.resolve({ data: [verdict], error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });
  const service = {
    rpc,
    from: jest.fn((table: string) => {
      if (table === "user_event_roles") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: existingRole ? { role: existingRole } : null,
            error: null,
          }),
          insert,
          update,
        };
      }
      if (table === "role_passwords") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: passwordHash ? { password_hash: passwordHash } : null,
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(service);
  (createSupabaseClient as jest.Mock).mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { event_id: "event-1" }, error: null }),
    })),
  });
  return { insert, update, rpc };
}

const verify = (body: Record<string, unknown>) =>
  POST(new Request("http://localhost/api/roles/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId: "event-1", ...body }),
  }));

describe("POST /api/roles/verify", () => {
  beforeEach(() => jest.clearAllMocks());

  it("requires a configured password for mentors (MENT-017)", async () => {
    const { insert } = setup({ passwordHash: null });
    const res = await verify({ role: EventRole.Mentor });
    expect(res.status).toBe(403);
    expect(insert).not.toHaveBeenCalled();
  });

  it("requires an invitation for judges without a password", async () => {
    const { insert } = setup({ passwordHash: null });
    expect((await verify({ role: EventRole.Judge })).status).toBe(403);
    expect(insert).not.toHaveBeenCalled();
  });

  it("never grants organizer through a role password (ORG-013)", async () => {
    const { insert } = setup();
    mockCompare.mockResolvedValue(true);
    const res = await verify({ role: EventRole.Organizer, password: "correct-password" });
    expect(res.status).toBe(403);
    expect(mockCompare).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects missing and wrong passwords, consuming the attempt before comparing", async () => {
    const { insert, rpc } = setup();
    expect((await verify({ role: EventRole.Mentor })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();

    mockCompare.mockResolvedValueOnce(false);
    const wrong = await verify({ role: EventRole.Mentor, password: "wrong-password" });
    expect(wrong.status).toBe(401);
    expect(rpc).toHaveBeenCalledWith("consume_role_password_attempt", {
      p_user_id: "user-1", p_event_id: "event-1", p_role: EventRole.Mentor,
    });
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(mockCompare.mock.invocationCallOrder[0]);
    expect(rpc).not.toHaveBeenCalledWith("clear_role_password_failures", expect.anything());
    expect(insert).not.toHaveBeenCalled();
  });

  it("returns 429 without comparing when the attempt budget is exhausted (even for the right password)", async () => {
    const { insert } = setup({ verdicts: [{ allowed: false, retry_at: new Date(Date.now() + 60_000).toISOString(), scope: "user" }] });
    mockCompare.mockResolvedValue(true);
    const res = await verify({ role: EventRole.Judge, password: "correct-password" });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(mockCompare).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("serializes a parallel burst: only attempts the database allowed are compared", async () => {
    const allowed = { allowed: true, retry_at: null, scope: null };
    const locked = { allowed: false, retry_at: new Date(Date.now() + 60_000).toISOString(), scope: "user" };
    const { insert } = setup({ verdicts: [allowed, allowed, allowed, allowed, allowed, locked] });
    mockCompare.mockImplementation(async (pw: string) => pw === "correct-password");
    const passwords = Array.from({ length: 9 }, (_, i) => `wrong-${i}`).concat("correct-password");
    const results = await Promise.all(passwords.map((password) => verify({ role: EventRole.Judge, password })));
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 401)).toHaveLength(5);
    expect(statuses.filter((s) => s === 429)).toHaveLength(5);
    expect(statuses[9]).toBe(429);
    expect(mockCompare).toHaveBeenCalledTimes(5);
    expect(insert).not.toHaveBeenCalled();
  });

  it("reports 500 when the throttle cannot be consulted", async () => {
    const { rpc } = setup();
    (rpc as jest.Mock).mockImplementation(() => Promise.resolve({ data: null, error: { code: "XX" } }));
    expect((await verify({ role: EventRole.Judge, password: "x" })).status).toBe(500);
    expect(mockCompare).not.toHaveBeenCalled();
  });

  it("assigns the role to the session user with a correct password and clears failures", async () => {
    const { insert, rpc } = setup();
    mockCompare.mockResolvedValueOnce(true);
    const res = await verify({ role: EventRole.Mentor, password: "correct-password", userId: "someone-else" });
    expect(res.status).toBe(200);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "user-1", event_id: "event-1", role: EventRole.Mentor }));
    expect(rpc).toHaveBeenCalledWith("clear_role_password_failures", expect.any(Object));
  });

  it("never downgrades an existing organizer (MENT-017)", async () => {
    const { insert, update } = setup({ existingRole: EventRole.Organizer });
    mockCompare.mockResolvedValue(true);
    const res = await verify({ role: EventRole.Mentor, password: "correct-password" });
    expect(res.status).toBe(409);
    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("returns 409 when the user already has the requested role", async () => {
    const { insert } = setup({ existingRole: EventRole.Judge });
    expect((await verify({ role: EventRole.Judge, password: "x" })).status).toBe(409);
    expect(insert).not.toHaveBeenCalled();
  });

  it("upgrades an existing participant with the staff password via update, not upsert", async () => {
    const { insert, update } = setup({ existingRole: EventRole.Participant });
    mockCompare.mockResolvedValueOnce(true);
    const res = await verify({ role: EventRole.Judge, password: "correct-password" });
    expect(res.status).toBe(200);
    expect(insert).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ role: EventRole.Judge }));
  });

  it("joins participants through joinParticipantEvent (approval/capacity rules)", async () => {
    setup({ passwordHash: null });
    mockJoin.mockResolvedValue({ status: "approval_requested", requiresApproval: true, requestId: "r1", requestStatus: "pending", message: "ok" });
    const res = await verify({ role: EventRole.Participant });
    expect(res.status).toBe(200);
    expect(mockJoin).toHaveBeenCalledWith(expect.anything(), { eventId: "event-1", userId: "user-1", channel: "web" });
  });

  it("rejects malformed bodies with 400", async () => {
    setup();
    const res = await POST(new Request("http://localhost/api/roles/verify", { method: "POST", body: "not json" }));
    expect(res.status).toBe(400);
  });
});
