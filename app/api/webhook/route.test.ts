/** @jest-environment node */
import { NextRequest } from "next/server";
import { POST } from "./route";
import { createSupabaseServiceClient } from "@/app/utils/supabase/server";

jest.mock("openai", () => jest.fn(() => ({})));
jest.mock("@/app/utils/supabase/server", () => ({ createSupabaseServiceClient: jest.fn() }));
jest.mock("@/lib/stream-video", () => ({
  streamVideo: {
    verifyWebhook: jest.fn(() => true),
    video: { call: jest.fn(() => ({ end: jest.fn(async () => undefined) })) },
  },
}));
jest.mock("@/lib/stream-chat", () => ({ streamChat: {} }));
jest.mock("@/lib/inngest/client", () => ({ inngest: { send: jest.fn() } }));

const fetchMock = jest.fn();
const meetingId = "123e4567-e89b-42d3-a456-426614174000";
const callCid = `default:${meetingId}`;

const deliver = (event: Record<string, unknown>) =>
  POST(new NextRequest("http://localhost/api/webhook", {
    method: "POST",
    headers: { "x-signature": "sig", "x-api-key": "key" },
    body: JSON.stringify(event),
  }));

beforeEach(() => {
  jest.clearAllMocks();
  process.env.SCREEN_VISION_WORKER_URL = "http://worker.test";
  process.env.SCREEN_VISION_WORKER_SECRET = "test-worker-secret";
  fetchMock.mockImplementation(async () => new Response("{}", { status: 200 }));
  global.fetch = fetchMock as unknown as typeof fetch;

  const rows: Record<string, unknown> = {
    meetings: { id: meetingId, agent_id: "agent", project_id: null, status: "upcoming" },
    agents: { id: "agent", instructions: "be kind", voice: null },
  };
  (createSupabaseServiceClient as jest.Mock).mockResolvedValue({
    from: jest.fn((table: string) => {
      const builder = {
        select: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(async () => ({ data: rows[table] ?? null, error: null })),
        then: (resolve: (value: unknown) => void) => resolve({ data: null, error: null }),
      };
      return builder;
    }),
  });
});

it.each([
  ["call.session_started", { call_cid: callCid }, "/session/start"],
  ["call.session_participant_left", { call_cid: callCid }, "/session/stop"],
  ["call.session_ended", { call_cid: callCid }, "/session/stop"],
  ["custom", { call_cid: callCid, custom: { type: "agent_pause" } }, "/session/pause"],
  ["custom", { call_cid: callCid, custom: { type: "agent_resume" } }, "/session/resume"],
])("authenticates %s to worker %j %s", async (type, event, workerPath) => {
  await deliver({ type, ...event });

  const call = fetchMock.mock.calls.find(([url]) => url === `http://worker.test${workerPath}`);
  expect(call).toBeDefined();
  expect(call![1].headers["x-worker-secret"]).toBe("test-worker-secret");
});
