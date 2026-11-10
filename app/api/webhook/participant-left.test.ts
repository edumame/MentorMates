/** @jest-environment node */
import { NextRequest } from "next/server";
import { POST } from "./route";
import { createSupabaseServiceClient } from "@/app/utils/supabase/server";
import { streamVideo } from "@/lib/stream-video";
import { inngest } from "@/lib/inngest/client";

jest.mock("openai", () => jest.fn());
jest.mock("@/app/utils/supabase/server", () => ({ createSupabaseServiceClient: jest.fn() }));
jest.mock("@/lib/stream-chat", () => ({ streamChat: {} }));
jest.mock("@/lib/inngest/client", () => ({ inngest: { send: jest.fn() } }));
jest.mock("@/lib/stream-config", () => ({
  ...jest.requireActual("@/lib/stream-config"),
  isStreamVideoConfigured: jest.fn(() => true),
  isStreamChatConfigured: jest.fn(() => true),
}));
jest.mock("@/lib/stream-video", () => ({
  streamVideo: { verifyWebhook: jest.fn(), video: { call: jest.fn() } },
}));

const meetingId = "meeting-1";
const end = jest.fn();
const fetchMock = jest.fn();
let meeting: { agent_id: string; user_id: string | null } | null;
let meetingError: { message: string } | null;

const participantLeft = (userId: string, reason?: string) =>
  new NextRequest("http://localhost/api/webhook", {
    method: "POST",
    headers: { "x-signature": "signature", "x-api-key": "key" },
    body: JSON.stringify({
      type: "call.session_participant_left",
      call_cid: `default:${meetingId}`,
      session_id: "session-1",
      participant: { user: { id: userId }, user_session_id: "user-session-1", role: "user" },
      reason,
    }),
  });

beforeEach(() => {
  jest.clearAllMocks();
  meeting = { agent_id: "agent-1", user_id: "owner-1" };
  meetingError = null;
  global.fetch = fetchMock;
  process.env.SCREEN_VISION_WORKER_URL = "http://worker.test";
  (streamVideo.verifyWebhook as jest.Mock).mockReturnValue(true);
  (streamVideo.video.call as jest.Mock).mockReturnValue({ end });
  (inngest.send as jest.Mock).mockResolvedValue({ ids: ["event"] });
  (createSupabaseServiceClient as jest.Mock).mockResolvedValue({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn(async () => ({ data: meeting, error: meetingError })),
        })),
      })),
    })),
  });
});

describe("POST /api/webhook call.session_participant_left", () => {
  it("does not end the call or schedule a check when the agent drops", async () => {
    const response = await POST(participantLeft("agent-1"));

    expect(response.status).toBe(200);
    expect(end).not.toHaveBeenCalled();
    expect(inngest.send).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["the owner, who may only be refreshing", "owner-1", undefined],
    ["a non-owner", "organizer-1", undefined],
    ["someone dropped by a timeout", "owner-1", "timeout"],
  ])("defers the decision when %s leaves", async (_label, userId, reason) => {
    const response = await POST(participantLeft(userId, reason));

    expect(response.status).toBe(200);
    expect(end).not.toHaveBeenCalled();
    expect(inngest.send).toHaveBeenCalledWith({
      name: "meetings/participant-left",
      data: { meetingId, agentId: "agent-1", ownerId: "owner-1", leftUserId: userId },
    });
  });

  it("passes on a missing owner for a meeting that has none", async () => {
    meeting = { agent_id: "agent-1", user_id: null };

    await POST(participantLeft("organizer-1"));

    expect(inngest.send).toHaveBeenCalledWith({
      name: "meetings/participant-left",
      data: { meetingId, agentId: "agent-1", ownerId: null, leftUserId: "organizer-1" },
    });
  });

  it("keeps the agent connected while the participant may still come back", async () => {
    await POST(participantLeft("owner-1"));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing for a call with no meeting", async () => {
    meeting = null;

    const response = await POST(participantLeft("owner-1"));

    expect(response.status).toBe(404);
    expect(end).not.toHaveBeenCalled();
    expect(inngest.send).not.toHaveBeenCalled();
  });

  it("does nothing when the meeting lookup fails", async () => {
    meetingError = { message: "boom" };

    const response = await POST(participantLeft("owner-1"));

    expect(response.status).toBe(404);
    expect(end).not.toHaveBeenCalled();
    expect(inngest.send).not.toHaveBeenCalled();
  });
});
