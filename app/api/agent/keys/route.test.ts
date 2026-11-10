/** @jest-environment node */
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";

jest.mock("@/app/utils/supabase/server", () => ({ createSupabaseClient: jest.fn() }));
jest.mock("@/lib/agent/auth", () => ({
  generateApiKey: () => ({ raw: "mm_sk_test", hash: "hash", prefix: "mm_sk_te" }),
}));

const EVENT = "11111111-1111-4111-8111-111111111111";

function setup() {
  const inserted: Record<string, unknown>[] = [];
  const listQuery: Record<string, jest.Mock> = {};
  for (const m of ["select", "eq", "is", "order", "or"]) listQuery[m] = jest.fn(() => listQuery);
  (listQuery as unknown as { then: unknown }).then = (r: (v: unknown) => void) =>
    Promise.resolve({ data: [], error: null }).then(r);
  const from = jest.fn((table: string) => {
    if (table === "user_event_roles") {
      const q: Record<string, jest.Mock> = {};
      q.select = jest.fn(() => q);
      q.eq = jest.fn(() => q);
      q.maybeSingle = jest.fn().mockResolvedValue({ data: { role: "organizer" } });
      return q;
    }
    return {
      ...listQuery,
      insert: jest.fn((row: Record<string, unknown>) => {
        inserted.push(row);
        return {
          select: () => ({
            single: async () => ({ data: { id: "k1", ...row, key_prefix: "mm_sk_te" }, error: null }),
          }),
        };
      }),
    };
  });
  (createSupabaseClient as jest.Mock).mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "u1" } }, error: null }) },
    rpc: jest.fn().mockResolvedValue({ data: false }),
    from,
  });
  return { inserted, listQuery };
}

const post = (body: unknown) =>
  POST(new NextRequest("http://localhost/api/agent/keys", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => jest.clearAllMocks());

describe("agent keys (ORG-023)", () => {
  it("scopes a key to the event when event_id is given without scope_mode", async () => {
    const { inserted } = setup();
    const res = await post({ event_id: EVENT, label: "laptop" });
    expect(res.status).toBe(201);
    expect(inserted[0].event_id).toBe(EVENT);
  });

  it("still allows an explicit account-wide key", async () => {
    const { inserted } = setup();
    await post({ event_id: EVENT, scope_mode: "public" });
    expect(inserted[0].event_id).toBeNull();
  });

  it("lists the event's keys plus account-wide keys (labelled in the UI)", async () => {
    const { listQuery } = setup();
    const res = await GET(new NextRequest(`http://localhost/api/agent/keys?event_id=${EVENT}`));
    expect(res.status).toBe(200);
    expect(listQuery.or).toHaveBeenCalledWith(`event_id.eq.${EVENT},event_id.is.null`);
  });

  it("rejects a malformed event_id filter", async () => {
    setup();
    const res = await GET(new NextRequest("http://localhost/api/agent/keys?event_id=x,event_id.is.null"));
    expect(res.status).toBe(400);
  });
});
