/** @jest-environment node */
import { meetingsProcessing } from "./functions";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

jest.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: jest.fn() }));
jest.mock("@inngest/agent-kit", () => ({ createAgent: jest.fn(), openai: jest.fn() }));

type Internals = {
  fn: (ctx: unknown) => Promise<unknown>;
  opts: { onFailure?: (ctx: unknown) => Promise<unknown> };
  getConfig: (opts: { baseUrl: URL; appPrefix: string }) => Array<{ id: string }>;
};
type UpdateBuilder = {
  update: (value: Record<string, unknown>) => UpdateBuilder;
  eq: (key: string, value: unknown) => UpdateBuilder;
  then: (resolve: (result: { error: unknown }) => void) => void;
};
const internals = meetingsProcessing as unknown as Internals;

const meetingId = "123e4567-e89b-42d3-a456-426614174000";
const failure = (data: Record<string, unknown> = { meetingId }) => ({
  event: { data: { event: { name: "meetings/processing", data } } },
});

let meeting: Record<string, unknown>;
let updateError: { message: string } | null;
let updates: Array<Record<string, unknown>>;

beforeEach(() => {
  jest.clearAllMocks();
  meeting = { id: meetingId, status: "processing", ended_at: "2026-01-01T12:00:00.000Z" };
  updateError = null;
  updates = [];
  (createSupabaseServiceClient as jest.Mock).mockReturnValue({
    from: jest.fn(() => {
      const filters: Record<string, unknown> = {};
      let patch: Record<string, unknown> = {};
      const builder: UpdateBuilder = {
        update: jest.fn((value: Record<string, unknown>) => { patch = value; return builder; }),
        eq: jest.fn((key: string, value: unknown) => { filters[key] = value; return builder; }),
        then: (resolve: (result: { error: unknown }) => void) => {
          if (!updateError && Object.entries(filters).every(([key, value]) => meeting[key] === value)) {
            updates.push(patch);
            Object.assign(meeting, patch);
          }
          resolve({ error: updateError });
        },
      };
      return builder;
    }),
  });
});

describe("meetingsProcessing onFailure", () => {
  const onFailure = (ctx = failure()) => {
    expect(internals.opts.onFailure).toEqual(expect.any(Function));
    return internals.opts.onFailure!(ctx);
  };

  it("registers a failure handler with Inngest", () => {
    const configs = internals.getConfig({
      baseUrl: new URL("http://localhost/api/inngest"),
      appPrefix: "mentor-mates",
    });
    expect(configs.map((config) => config.id)).toContain("mentor-mates-meetings/processing-failure");
  });

  it("returns a failed meeting to the state a user can resubmit from", async () => {
    await onFailure();
    expect(meeting.status).toBe("upcoming");
    expect(meeting.ended_at).toBeNull();
  });

  it.each(["completed", "upcoming", "active", "cancelled"])("leaves a %s meeting alone", async (status) => {
    meeting.status = status;
    await onFailure();
    expect(meeting.status).toBe(status);
    expect(updates).toEqual([]);
  });

  it("rethrows a failed update so Inngest retries the release", async () => {
    updateError = { message: "database failure" };
    await expect(onFailure()).rejects.toEqual(updateError);
  });

  it("does nothing for an event without a meeting id", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    await onFailure(failure({}));
    expect(createSupabaseServiceClient).not.toHaveBeenCalled();
    expect(meeting.status).toBe("processing");
    spy.mockRestore();
  });
});

describe("meetingsProcessing fetch-transcript", () => {
  const transcriptUrl = "https://stream.example/transcript.jsonl?signature=secret";
  const runUntilParse = (data: Record<string, unknown>) => {
    const parsed = new Error("stop after fetch-transcript");
    const seen: { value?: unknown } = {};
    const step = {
      run: async (name: string, callback: () => Promise<unknown>) => {
        if (name === "parse-transcript") throw parsed;
        seen.value = await callback();
        return seen.value;
      },
    };
    return { seen, parsed, run: internals.fn({ event: { data }, step }) };
  };
  const originalFetch = global.fetch;

  afterEach(() => { global.fetch = originalFetch; });

  it("names the HTTP status instead of handing an error body to the parser", async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response("<Error><Code>AccessDenied</Code></Error>", { status: 403 }));
    const { run } = runUntilParse({ meetingId, transcriptUrl });
    await expect(run).rejects.toThrow(/403/);
    await expect(run).rejects.not.toThrow(/secret/);
  });

  it("returns the transcript body on success", async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response('{"speaker_id":"a"}', { status: 200 }));
    const { run, seen, parsed } = runUntilParse({ meetingId, transcriptUrl });
    await expect(run).rejects.toBe(parsed);
    expect(seen.value).toBe('{"speaker_id":"a"}');
  });
});
