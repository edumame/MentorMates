/** @jest-environment node */
import { meetingsEndAbandonedCall } from "./functions";
import { streamVideo } from "@/lib/stream-video";

type Handler = (ctx: {
  event: {
    data: { meetingId: string; agentId: string; ownerId: string | null; leftUserId: string };
  };
  step: {
    run: <T>(id: string, fn: () => Promise<T>) => Promise<T>;
    sleep: (id: string, duration: string) => Promise<void>;
  };
}) => Promise<unknown>;

jest.mock("@/lib/inngest/client", () => ({
  inngest: {
    createFunction: jest.fn((options: unknown, trigger: unknown, handler: unknown) => ({
      options,
      trigger,
      handler,
    })),
  },
}));
jest.mock("@inngest/agent-kit", () => ({}));
jest.mock("jsonl-parse-stringify", () => ({}));
jest.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: jest.fn() }));
jest.mock("@/lib/stream-video", () => ({ streamVideo: { video: { call: jest.fn() } } }));

const { options, trigger, handler } = meetingsEndAbandonedCall as unknown as {
  options: { debounce: { key: string; period: string } };
  trigger: { event: string };
  handler: Handler;
};

const get = jest.fn();
const end = jest.fn();
const sleep = jest.fn();
const run = ({ leftUserId = "owner-1", ownerId = "owner-1" as string | null } = {}) =>
  handler({
    event: { data: { meetingId: "meeting-1", agentId: "agent-1", ownerId, leftUserId } },
    step: { run: (_id, fn) => fn(), sleep },
  });
const session = (...userIds: string[]) => ({
  participants: userIds.map((id) => ({ user: { id } })),
});

beforeEach(() => {
  jest.clearAllMocks();
  (streamVideo.video.call as jest.Mock).mockReturnValue({ get, end });
  end.mockResolvedValue({});
  sleep.mockResolvedValue(undefined);
});

describe("meetingsEndAbandonedCall", () => {
  it("waits out a grace window per meeting, restarting on each departure", () => {
    expect(trigger.event).toBe("meetings/participant-left");
    expect(options.debounce).toEqual({ key: "event.data.meetingId", period: "60s" });
  });

  it("ends the call when only the agent is left", async () => {
    get.mockResolvedValue({ call: { session: session("agent-1") } });

    await run();

    expect(streamVideo.video.call).toHaveBeenCalledWith("default", "meeting-1");
    expect(end).toHaveBeenCalledTimes(1);
  });

  it("ends the call when nobody is left", async () => {
    get.mockResolvedValue({ call: { session: session() } });

    await run();

    expect(end).toHaveBeenCalledTimes(1);
  });

  it("ends the call when there is no session", async () => {
    get.mockResolvedValue({ call: {} });

    await run();

    expect(end).toHaveBeenCalledTimes(1);
  });

  it("keeps the call when a refreshed participant has rejoined", async () => {
    get.mockResolvedValue({ call: { session: session("agent-1", "owner-1") } });

    await run();

    expect(end).not.toHaveBeenCalled();
  });

  it("keeps the call for the owner when a non-owner has left", async () => {
    get.mockResolvedValue({ call: { session: session("owner-1") } });

    await run();

    expect(end).not.toHaveBeenCalled();
  });

  it("ends the call straight after the grace window when the owner was the one who left", async () => {
    get.mockResolvedValue({ call: { session: session("agent-1") } });

    await run({ leftUserId: "owner-1" });

    expect(sleep).not.toHaveBeenCalled();
    expect(end).toHaveBeenCalledTimes(1);
  });

  it("does not wait for an owner on a meeting that has none", async () => {
    get.mockResolvedValue({ call: { session: session("agent-1") } });

    await run({ leftUserId: "organizer-1", ownerId: null });

    expect(sleep).not.toHaveBeenCalled();
    expect(end).toHaveBeenCalledTimes(1);
  });

  it("does not end the call while waiting for an owner who has not arrived", async () => {
    get.mockResolvedValue({ call: { session: session("agent-1") } });
    sleep.mockImplementation(async () => {
      expect(end).not.toHaveBeenCalled();
    });

    await run({ leftUserId: "organizer-1" });

    expect(sleep).toHaveBeenCalledWith("wait-for-owner", "30m");
  });

  it("keeps the call when the owner arrives during the wait", async () => {
    get
      .mockResolvedValueOnce({ call: { session: session("agent-1") } })
      .mockResolvedValueOnce({ call: { session: session("agent-1", "owner-1") } });

    await run({ leftUserId: "organizer-1" });

    expect(sleep).toHaveBeenCalledTimes(1);
    expect(end).not.toHaveBeenCalled();
  });

  it("ends the call when the owner never arrives during the wait", async () => {
    get.mockResolvedValue({ call: { session: session("agent-1") } });

    await run({ leftUserId: "organizer-1" });

    expect(sleep).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledTimes(1);
  });

  it("does not end a call that ended during the wait", async () => {
    get
      .mockResolvedValueOnce({ call: { session: session("agent-1") } })
      .mockResolvedValueOnce({ call: { ended_at: new Date(), session: session() } });

    await run({ leftUserId: "organizer-1" });

    expect(end).not.toHaveBeenCalled();
  });

  it("does not wait when someone is still in the call after a non-owner left", async () => {
    get.mockResolvedValue({ call: { session: session("agent-1", "organizer-2") } });

    await run({ leftUserId: "organizer-1" });

    expect(sleep).not.toHaveBeenCalled();
    expect(end).not.toHaveBeenCalled();
  });

  it("does not end a call that has already ended", async () => {
    get.mockResolvedValue({ call: { ended_at: new Date(), session: session() } });

    await run();

    expect(end).not.toHaveBeenCalled();
  });

  it("lets a failed lookup surface so Inngest retries it", async () => {
    get.mockRejectedValue(new Error("stream down"));

    await expect(run()).rejects.toThrow("stream down");
    expect(end).not.toHaveBeenCalled();
  });
});
