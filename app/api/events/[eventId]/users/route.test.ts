/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { GET } from "./route";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

const EVENT_ID = "11111111-1111-1111-1111-111111111111";

function chain(result: unknown) {
  const builder: Record<string, unknown> = {
    then: (onOk: (v: unknown) => unknown) =>
      Promise.resolve(result).then(onOk),
    maybeSingle: async () => result,
  };
  for (const method of ["select", "eq", "in", "range"]) {
    builder[method] = jest.fn(() => builder);
  }
  builder.order = jest.fn(() => builder);
  return builder;
}

describe("GET /api/events/[eventId]/users", () => {
  it("sorts on a unique tiebreaker so offset pages cannot skip or repeat rows", async () => {
    (createSupabaseClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: "viewer" } }, error: null }),
      },
      from: () => chain({ data: { role: "participant" } }),
      rpc: async () => ({ data: false }),
    });
    const roles = chain({ data: [], error: null, count: 0 });
    (createSupabaseServiceClient as jest.Mock).mockReturnValue({
      from: (table: string) =>
        table === "user_event_roles" ? roles : chain({ data: [] }),
    });

    const response = await GET(
      new NextRequest(
        `http://localhost/api/events/${EVENT_ID}/users?limit=500&offset=500`
      ),
      { params: Promise.resolve({ eventId: EVENT_ID }) }
    );

    expect(response.status).toBe(200);
    expect((roles.order as jest.Mock).mock.calls).toEqual([
      ["created_at", { ascending: true }],
      ["user_id", { ascending: true }],
    ]);
    expect(roles.range).toHaveBeenCalledWith(500, 999);
  });
});
