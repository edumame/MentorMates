/** @jest-environment node */
import { NextRequest } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { POST } from "./route";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

const mockCreateClient = createSupabaseClient as jest.Mock;

const installRequest = () =>
  new NextRequest("http://localhost/api/agent/install", {
    method: "POST",
    body: JSON.stringify({ event_id: "event-1" }),
  });

function organizerClient() {
  const maybeSingle = jest
    .fn()
    .mockResolvedValue({ data: { role: "organizer" } });
  const single = jest
    .fn()
    .mockResolvedValue({ data: { event_name: "Test Event" } });
  const query = { select: jest.fn(), eq: jest.fn(), maybeSingle, single };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);

  return {
    auth: {
      getUser: jest
        .fn()
        .mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
    },
    rpc: jest.fn().mockResolvedValue({ data: false }),
    from: jest.fn((table: string) =>
      table === "agent_api_keys"
        ? { insert: jest.fn().mockResolvedValue({ error: null }) }
        : query
    ),
  };
}

describe("POST /api/agent/install", () => {
  it("rejects a request without a session, as a terminal curl would be", async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest
          .fn()
          .mockResolvedValue({ data: { user: null }, error: null }),
      },
    });

    const response = await POST(installRequest());

    expect(response.status).toBe(401);
  });

  it("creates the commands directory that skill_save writes into", async () => {
    mockCreateClient.mockResolvedValue(organizerClient());

    const response = await POST(installRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.setup_commands.skill_save).toContain(
      "mkdir -p .claude/commands &&"
    );
  });
});
