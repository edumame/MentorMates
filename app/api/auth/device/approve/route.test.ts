/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { hashApiKey } from "@/lib/agent/crypto";
import {
  APPROVE_ATTEMPT_LIMIT_PER_USER,
  DEVICE_AUTH_NOT_CONFIGURED_MESSAGE,
  decryptApiKey,
} from "@/lib/agent/device-auth";
import {
  DEFAULT_ORGANIZER_AGENT_SCOPES,
  DEFAULT_PARTICIPANT_AGENT_SCOPES,
} from "@/lib/agent/scopes";
import { EventRole } from "@/lib/types";
import { FakeSupabase } from "../_test/fake-supabase";
import { GET, POST } from "./route";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

const mockCreateSupabaseClient = createSupabaseClient as jest.Mock;
const mockServiceClient = createSupabaseServiceClient as jest.Mock;

const TEST_KEY = "b".repeat(64);
const USER_ID = "user-1";
const CODE = "ABCD2345";

function seedCode(db: FakeSupabase, overrides: Record<string, unknown> = {}) {
  const row = {
    id: "code-1",
    device_code_hash: "device-hash-1",
    user_code: CODE,
    user_id: null,
    access_mode: "participant",
    status: "pending",
    api_key_id: null,
    api_key_raw_encrypted: null,
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    last_polled_at: null,
    ...overrides,
  };
  db.tables.device_auth_codes.push(row);
  return row;
}

function signIn(userId: string | null) {
  mockCreateSupabaseClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue(
        userId
          ? { data: { user: { id: userId } }, error: null }
          : { data: { user: null }, error: { message: "no session" } },
      ),
    },
  });
}

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/device/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function getRequest(code: string | null) {
  const url = new URL("http://localhost/api/auth/device/approve");
  if (code !== null) url.searchParams.set("user_code", code);
  return new NextRequest(url);
}

describe("/api/auth/device/approve", () => {
  const originalEnv = process.env;
  let db: FakeSupabase;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    process.env = { ...originalEnv, DEVICE_AUTH_ENCRYPTION_KEY: TEST_KEY };
    db = new FakeSupabase();
    mockServiceClient.mockReturnValue(db);
    signIn(USER_ID);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("POST", () => {
    it("approves a pending participant code and stores one encrypted key", async () => {
      seedCode(db);

      const response = await POST(postRequest({ user_code: CODE }));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({ success: true, access_mode: "participant" });

      expect(db.tables.agent_api_keys).toHaveLength(1);
      const key = db.tables.agent_api_keys[0];
      expect(key.user_id).toBe(USER_ID);
      expect(key.scopes).toEqual([...DEFAULT_PARTICIPANT_AGENT_SCOPES]);

      const row = db.tables.device_auth_codes[0];
      expect(row.status).toBe("approved");
      expect(row.user_id).toBe(USER_ID);
      expect(row.api_key_id).toBe(key.id);
      const raw = decryptApiKey(row.api_key_raw_encrypted as string);
      expect(raw).toMatch(/^mm_sk_/);
      expect(hashApiKey(raw)).toBe(key.key_hash);
    });

    it.each([
      ["lowercase", "abcd2345"],
      ["dashed and spaced", " ABCD-2345 "],
    ])("normalizes %s user codes", async (_label, input) => {
      seedCode(db);
      const response = await POST(postRequest({ user_code: input }));
      expect(response.status).toBe(200);
    });

    it("returns 401 without a session and does not touch the code", async () => {
      signIn(null);
      seedCode(db);
      const response = await POST(postRequest({ user_code: CODE }));
      expect(response.status).toBe(401);
      expect(db.tables.device_auth_codes[0].status).toBe("pending");
      expect(db.rateLimits.size).toBe(0);
    });

    it.each([
      ["missing", {}],
      ["non-string", { user_code: 12345678 }],
      ["wrong length", { user_code: "ABC" }],
      ["ambiguous characters", { user_code: "ABCD1O00" }],
      ["invalid JSON", "{nope"],
    ])("returns 400 for a %s user_code", async (_label, body) => {
      const response = await POST(postRequest(body));
      expect(response.status).toBe(400);
    });

    it("returns 404 for an unknown code", async () => {
      const response = await POST(postRequest({ user_code: CODE }));
      expect(response.status).toBe(404);
      expect(db.tables.agent_api_keys).toHaveLength(0);
    });

    it.each(["approved", "approving"])(
      "returns 409 when the code is already %s and mints no key",
      async (status) => {
        seedCode(db, { status });
        const response = await POST(postRequest({ user_code: CODE }));
        expect(response.status).toBe(409);
        expect((await response.json()).error).toBe("Code already used");
        expect(db.tables.agent_api_keys).toHaveLength(0);
      },
    );

    it("returns 410 and marks the row expired when past expires_at", async () => {
      seedCode(db, { expires_at: new Date(Date.now() - 1000).toISOString() });
      const response = await POST(postRequest({ user_code: CODE }));
      expect(response.status).toBe(410);
      expect(db.tables.device_auth_codes[0].status).toBe("expired");
      expect(db.tables.agent_api_keys).toHaveLength(0);
    });

    it("returns 410 for a row already marked expired", async () => {
      seedCode(db, { status: "expired" });
      const response = await POST(postRequest({ user_code: CODE }));
      expect(response.status).toBe(410);
    });

    it("a second sequential approval does not mint a second key", async () => {
      seedCode(db);
      expect((await POST(postRequest({ user_code: CODE }))).status).toBe(200);
      const second = await POST(postRequest({ user_code: CODE }));
      expect(second.status).toBe(409);
      expect(db.tables.agent_api_keys).toHaveLength(1);
    });

    it("concurrent approvals mint exactly one key", async () => {
      seedCode(db);
      signIn(USER_ID);

      const responses = await Promise.all(
        Array.from({ length: 5 }, () => POST(postRequest({ user_code: CODE }))),
      );
      const statuses = responses.map((r) => r.status).sort();

      expect(statuses.filter((s) => s === 200)).toHaveLength(1);
      expect(statuses.filter((s) => s === 409)).toHaveLength(4);
      expect(db.tables.agent_api_keys).toHaveLength(1);
      expect(db.tables.device_auth_codes[0].api_key_id).toBe(db.tables.agent_api_keys[0].id);
    });

    it("concurrent approvals by different users still mint one key", async () => {
      seedCode(db);
      const clientFor = (id: string) => ({
        auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id } }, error: null }) },
      });
      mockCreateSupabaseClient
        .mockResolvedValueOnce(clientFor("user-a"))
        .mockResolvedValueOnce(clientFor("user-b"));

      const [a, b] = await Promise.all([
        POST(postRequest({ user_code: CODE })),
        POST(postRequest({ user_code: CODE })),
      ]);

      expect([a.status, b.status].sort()).toEqual([200, 409]);
      expect(db.tables.agent_api_keys).toHaveLength(1);
      expect(db.tables.device_auth_codes[0].user_id).toBe(db.tables.agent_api_keys[0].user_id);
    });

    it("releases the claim when key creation fails so the user can retry", async () => {
      seedCode(db);
      db.failNext("agent_api_keys", "insert");

      const failed = await POST(postRequest({ user_code: CODE }));
      expect(failed.status).toBe(500);
      expect(db.tables.agent_api_keys).toHaveLength(0);
      expect(db.tables.device_auth_codes[0]).toMatchObject({ status: "pending", user_id: null });

      const retry = await POST(postRequest({ user_code: CODE }));
      expect(retry.status).toBe(200);
      expect(db.tables.agent_api_keys).toHaveLength(1);
    });

    it("deletes the new key and releases the claim when finalizing fails", async () => {
      seedCode(db);
      // 1st update = claim, 2nd update = finalize (fails)
      const originalFrom = db.from.bind(db);
      let updates = 0;
      jest.spyOn(db, "from").mockImplementation((table: string) => {
        const query = originalFrom(table);
        if (table === "device_auth_codes") {
          const originalUpdate = query.update.bind(query);
          query.update = (values: Record<string, unknown>) => {
            updates += 1;
            if (updates === 2) db.failNext("device_auth_codes", "update");
            return originalUpdate(values);
          };
        }
        return query;
      });

      const response = await POST(postRequest({ user_code: CODE }));
      expect(response.status).toBe(500);
      expect(db.tables.agent_api_keys).toHaveLength(0);
      expect(db.tables.device_auth_codes[0]).toMatchObject({
        status: "pending",
        api_key_raw_encrypted: null,
      });
    });

    it("returns 409 when the claim loses a race after validation", async () => {
      seedCode(db);
      // Simulate another approver claiming between lookup and claim.
      const originalFrom = db.from.bind(db);
      jest.spyOn(db, "from").mockImplementation((table: string) => {
        const query = originalFrom(table);
        if (table === "device_auth_codes") {
          const originalUpdate = query.update.bind(query);
          query.update = (values: Record<string, unknown>) => {
            if (values.status === "approving") {
              db.tables.device_auth_codes[0].status = "approving";
            }
            return originalUpdate(values);
          };
        }
        return query;
      });

      const response = await POST(postRequest({ user_code: CODE }));
      expect(response.status).toBe(409);
      expect(db.tables.agent_api_keys).toHaveLength(0);
    });

    describe("organizer mode", () => {
      it("rejects a user with no organizer rights with a clear 403", async () => {
        seedCode(db, { access_mode: "organizer" });
        db.tables.user_event_roles.push(
          { user_id: USER_ID, event_id: "e1", role: EventRole.Participant },
          { user_id: USER_ID, event_id: "e2", role: EventRole.Judge },
        );

        const response = await POST(postRequest({ user_code: CODE }));
        expect(response.status).toBe(403);
        expect((await response.json()).error).toMatch(/organizer access/i);
        expect(db.tables.agent_api_keys).toHaveLength(0);
        expect(db.tables.device_auth_codes[0].status).toBe("pending");
      });

      it("ignores organizer roles held by other users", async () => {
        seedCode(db, { access_mode: "organizer" });
        db.tables.user_event_roles.push({
          user_id: "someone-else",
          event_id: "e1",
          role: EventRole.Organizer,
        });
        const response = await POST(postRequest({ user_code: CODE }));
        expect(response.status).toBe(403);
      });

      it.each([EventRole.Organizer, EventRole.Admin])(
        "allows a user with an event %s role and grants organizer scopes",
        async (role) => {
          seedCode(db, { access_mode: "organizer" });
          db.tables.user_event_roles.push({ user_id: USER_ID, event_id: "e1", role });

          const response = await POST(postRequest({ user_code: CODE }));
          expect(response.status).toBe(200);
          expect(db.tables.agent_api_keys[0].scopes).toEqual([
            ...DEFAULT_ORGANIZER_AGENT_SCOPES,
          ]);
        },
      );

      it("allows a platform admin with no event roles", async () => {
        seedCode(db, { access_mode: "organizer" });
        db.admins.add(USER_ID);
        const response = await POST(postRequest({ user_code: CODE }));
        expect(response.status).toBe(200);
      });

      it("fails closed with 500 when the admin check errors", async () => {
        seedCode(db, { access_mode: "organizer" });
        db.rpcFailures.set("is_admin_user", { message: "rpc down" });
        db.tables.user_event_roles.push({
          user_id: USER_ID,
          event_id: "e1",
          role: EventRole.Organizer,
        });
        const response = await POST(postRequest({ user_code: CODE }));
        expect(response.status).toBe(500);
        expect(db.tables.agent_api_keys).toHaveLength(0);
      });

      it("fails closed with 500 when the role lookup errors", async () => {
        seedCode(db, { access_mode: "organizer" });
        db.failNext("user_event_roles", "select");
        const response = await POST(postRequest({ user_code: CODE }));
        expect(response.status).toBe(500);
        expect(db.tables.agent_api_keys).toHaveLength(0);
      });

      it("does not require organizer rights for participant codes", async () => {
        seedCode(db);
        const response = await POST(postRequest({ user_code: CODE }));
        expect(response.status).toBe(200);
        expect(db.calls.some((c) => c.table === "user_event_roles")).toBe(false);
      });
    });

    describe("rate limiting", () => {
      it("limits approval attempts per user with 429", async () => {
        for (let i = 0; i < APPROVE_ATTEMPT_LIMIT_PER_USER; i++) {
          expect((await POST(postRequest({ user_code: CODE }))).status).toBe(404);
        }
        seedCode(db);
        const limited = await POST(postRequest({ user_code: CODE }));
        expect(limited.status).toBe(429);
        expect(limited.headers.get("Retry-After")).toBe("120");
        expect(db.tables.agent_api_keys).toHaveLength(0);
        expect(db.tables.device_auth_codes[0].status).toBe("pending");
      });

      it("keys the limit to the verified user id", async () => {
        seedCode(db);
        await POST(postRequest({ user_code: CODE }));
        expect(Array.from(db.rateLimits.keys())).toEqual([`approve:user:${USER_ID}`]);
      });

      it("fails closed with 503 when the limiter is unavailable", async () => {
        seedCode(db);
        db.rpcFailures.set("reserve_device_auth_attempt", { message: "down" });
        const response = await POST(postRequest({ user_code: CODE }));
        expect(response.status).toBe(503);
        expect(db.tables.agent_api_keys).toHaveLength(0);
      });
    });

    it("returns a clear 500 before any state change when the encryption key is missing", async () => {
      delete process.env.DEVICE_AUTH_ENCRYPTION_KEY;
      seedCode(db);

      const response = await POST(postRequest({ user_code: CODE }));
      expect(response.status).toBe(500);
      expect((await response.json()).error).toBe(DEVICE_AUTH_NOT_CONFIGURED_MESSAGE);
      expect(db.tables.agent_api_keys).toHaveLength(0);
      expect(db.tables.device_auth_codes[0].status).toBe("pending");
    });
  });

  describe("GET (preview)", () => {
    it("returns the access mode and scopes without approving", async () => {
      const row = seedCode(db, { access_mode: "participant" });
      const response = await GET(getRequest(CODE));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        access_mode: "participant",
        scopes: [...DEFAULT_PARTICIPANT_AGENT_SCOPES],
        expires_at: row.expires_at,
      });
      expect(db.tables.device_auth_codes[0].status).toBe("pending");
      expect(db.tables.agent_api_keys).toHaveLength(0);
    });

    it("shows organizer scopes to an organizer", async () => {
      seedCode(db, { access_mode: "organizer" });
      db.tables.user_event_roles.push({ user_id: USER_ID, event_id: "e1", role: EventRole.Organizer });
      const response = await GET(getRequest(CODE));
      expect((await response.json()).scopes).toEqual([...DEFAULT_ORGANIZER_AGENT_SCOPES]);
    });

    it("rejects organizer codes for non-organizers before the approve step", async () => {
      seedCode(db, { access_mode: "organizer" });
      const response = await GET(getRequest(CODE));
      expect(response.status).toBe(403);
    });

    it.each([
      ["missing code", null, 400],
      ["unknown code", CODE, 404],
    ])("handles %s", async (_label, code, status) => {
      const response = await GET(getRequest(code));
      expect(response.status).toBe(status);
    });

    it("returns 409 for used codes and 401 when signed out", async () => {
      seedCode(db, { status: "approved" });
      expect((await GET(getRequest(CODE))).status).toBe(409);
      signIn(null);
      expect((await GET(getRequest(CODE))).status).toBe(401);
    });

    it("counts previews toward the per-user attempt limit", async () => {
      await GET(getRequest(CODE));
      expect(db.rateLimits.get(`approve:user:${USER_ID}`)).toBe(1);
    });
  });
});
