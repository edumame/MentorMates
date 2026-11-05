/** @jest-environment node */

import type { NextRequest } from "next/server";
import { POST } from "./route";

const mockResponsesCreate = jest.fn();
const mockUpsertUser = jest.fn();
const mockSendMessage = jest.fn();
const mockMaybeSingle = jest.fn();

jest.mock("next/server", () => {
  class MockNextResponse {
    status: number;
    private readonly body: unknown;

    constructor(body: unknown, init?: ResponseInit) {
      this.status = init?.status ?? 200;
      this.body = body;
    }

    static json(body: unknown, init?: ResponseInit) {
      return new MockNextResponse(body, init);
    }

    async json() {
      return this.body;
    }
  }

  return { NextResponse: MockNextResponse };
});

jest.mock("openai", () => ({
  __esModule: true,
  default: class MockOpenAI {
    responses = {
      create: (...args: unknown[]) => mockResponsesCreate(...args),
    };
  },
}));

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseServiceClient: async () => {
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: () => mockMaybeSingle(),
    };
    return { from: () => query };
  },
}));

jest.mock("@/lib/stream-video", () => ({
  streamVideo: { verifyWebhook: () => true },
}));

jest.mock("@/lib/inngest/client", () => ({
  inngest: { send: jest.fn() },
}));

jest.mock("@/lib/stream-chat", () => ({
  streamChat: {
    upsertUser: (...args: unknown[]) => mockUpsertUser(...args),
    channel: () => ({
      watch: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue({ messages: [] }),
      sendMessage: (...args: unknown[]) => mockSendMessage(...args),
    }),
  },
}));

const AGENT = {
  id: "agent-1",
  name: "Agent",
  avatar_url: null,
  instructions: "Be helpful.",
};

let nextMessageId = 0;
function uniqueMessageId() {
  nextMessageId += 1;
  return `message-${nextMessageId}`;
}

function messageNewRequest(messageId: string) {
  const body = JSON.stringify({
    type: "message.new",
    channel_id: "meeting-1",
    user: { id: "user-1" },
    message: { id: messageId, text: "Hello" },
  });

  return {
    headers: { get: () => "present" },
    text: async () => body,
  } as unknown as NextRequest;
}

function mockUpcomingMeetingLookups() {
  mockMaybeSingle.mockImplementation(async () => {
    const lookup = mockMaybeSingle.mock.calls.length % 2;
    return lookup === 1
      ? { data: { id: "meeting-1", agent_id: AGENT.id }, error: null }
      : { data: AGENT, error: null };
  });
}

function mockCompletedMeetingLookups() {
  mockMaybeSingle.mockImplementation(async () => {
    const lookup = mockMaybeSingle.mock.calls.length % 3;
    if (lookup === 1) return { data: null, error: null };
    return lookup === 2
      ? {
          data: { id: "meeting-1", agent_id: AGENT.id, summary: "Summary" },
          error: null,
        }
      : { data: AGENT, error: null };
  });
}

const flushAsyncWork = () => new Promise((resolve) => setTimeout(resolve, 10));

describe.each([
  ["upcoming meeting chat", mockUpcomingMeetingLookups],
  ["completed meeting feedback chat", mockCompletedMeetingLookups],
])("POST /api/webhook message.new (%s)", (_name, mockLookups) => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    mockLookups();
    mockResponsesCreate.mockResolvedValue({ output_text: "Agent reply" });
    mockUpsertUser.mockResolvedValue({});
    mockSendMessage.mockResolvedValue({});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("does not respond until the agent is upserted and the reply is delivered", async () => {
    let finishUpsert: (value: unknown) => void = () => {};
    let finishSend: (value: unknown) => void = () => {};
    mockUpsertUser.mockReturnValue(
      new Promise((resolve) => {
        finishUpsert = resolve;
      })
    );
    mockSendMessage.mockReturnValue(
      new Promise((resolve) => {
        finishSend = resolve;
      })
    );

    let settled = false;
    const pending = POST(messageNewRequest(uniqueMessageId())).then(
      (response) => {
        settled = true;
        return response;
      }
    );

    await flushAsyncWork();
    expect(mockUpsertUser).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(settled).toBe(false);

    finishUpsert({});
    await flushAsyncWork();
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);

    finishSend({});
    const response = await pending;
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("returns a 5xx when delivery fails and answers the retry", async () => {
    const messageId = uniqueMessageId();
    mockSendMessage.mockRejectedValueOnce(new Error("Stream is down"));

    const failed = await POST(messageNewRequest(messageId));
    expect(failed.status).toBe(500);

    const retried = await POST(messageNewRequest(messageId));
    expect(retried.status).toBe(200);
    await expect(retried.json()).resolves.toEqual({ status: "ok" });
    expect(mockSendMessage).toHaveBeenCalledTimes(2);
  });

  it("returns a 5xx when the agent upsert fails and answers the retry", async () => {
    const messageId = uniqueMessageId();
    mockUpsertUser.mockRejectedValueOnce(new Error("Stream is down"));

    const failed = await POST(messageNewRequest(messageId));
    expect(failed.status).toBe(500);
    expect(mockSendMessage).not.toHaveBeenCalled();

    const retried = await POST(messageNewRequest(messageId));
    expect(retried.status).toBe(200);
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
  });

  it("keeps a message retryable when OpenAI throws", async () => {
    const messageId = uniqueMessageId();
    mockResponsesCreate.mockRejectedValueOnce(new Error("OpenAI is down"));

    const failed = await POST(messageNewRequest(messageId));
    expect(failed.status).toBe(500);
    expect(mockSendMessage).not.toHaveBeenCalled();

    const retried = await POST(messageNewRequest(messageId));
    expect(retried.status).toBe(200);
    await expect(retried.json()).resolves.toEqual({ status: "ok" });
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
  });

  it("keeps a message retryable when OpenAI returns no text", async () => {
    const messageId = uniqueMessageId();
    mockResponsesCreate.mockResolvedValueOnce({ output_text: "" });

    const failed = await POST(messageNewRequest(messageId));
    expect(failed.status).toBe(502);
    expect(mockSendMessage).not.toHaveBeenCalled();

    const retried = await POST(messageNewRequest(messageId));
    expect(retried.status).toBe(200);
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
  });

  it("ignores a redelivery while the first attempt is still in flight", async () => {
    const messageId = uniqueMessageId();
    let finishResponse: (value: unknown) => void = () => {};
    mockResponsesCreate.mockReturnValueOnce(
      new Promise((resolve) => {
        finishResponse = resolve;
      })
    );

    const first = POST(messageNewRequest(messageId));
    await flushAsyncWork();
    expect(mockResponsesCreate).toHaveBeenCalledTimes(1);

    const redelivery = await POST(messageNewRequest(messageId));
    await expect(redelivery.json()).resolves.toEqual({
      status: "duplicate_ignored",
    });

    finishResponse({ output_text: "Agent reply" });
    expect((await first).status).toBe(200);
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
  });

  it("ignores a redelivery of a message that was already answered", async () => {
    const messageId = uniqueMessageId();

    expect((await POST(messageNewRequest(messageId))).status).toBe(200);

    const redelivery = await POST(messageNewRequest(messageId));
    await expect(redelivery.json()).resolves.toEqual({
      status: "duplicate_ignored",
    });
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
  });
});
