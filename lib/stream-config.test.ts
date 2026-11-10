import {
  isStreamChatConfigured,
  isStreamVideoConfigured,
  lazyClient,
  StreamNotConfiguredError,
  streamVideoCredentials,
} from "./stream-config";

const ENV_KEYS = [
  "NEXT_PUBLIC_STREAM_VIDEO_API_KEY",
  "STREAM_VIDEO_SECRET_KEY",
  "STREAM_VIDEO_SCRET_KEY",
  "NEXT_PUBLIC_STREAM_CHAT_API_KEY",
  "STREAM_CHAT_SECRET_KEY",
];
const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
beforeEach(() => ENV_KEYS.forEach((key) => delete process.env[key]));
afterAll(() => ENV_KEYS.forEach((key) => { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }));

describe("stream configuration", () => {
  it("is unconfigured without keys (and with blank keys)", () => {
    expect(isStreamVideoConfigured()).toBe(false);
    process.env.NEXT_PUBLIC_STREAM_VIDEO_API_KEY = "k";
    process.env.STREAM_VIDEO_SECRET_KEY = "   ";
    expect(isStreamVideoConfigured()).toBe(false);
    expect(isStreamChatConfigured()).toBe(false);
  });

  it("accepts the correct secret name and prefers it over the legacy misspelling", () => {
    process.env.NEXT_PUBLIC_STREAM_VIDEO_API_KEY = "k";
    process.env.STREAM_VIDEO_SCRET_KEY = "legacy";
    expect(streamVideoCredentials()).toEqual({ apiKey: "k", secret: "legacy" });
    process.env.STREAM_VIDEO_SECRET_KEY = "correct";
    expect(streamVideoCredentials()).toEqual({ apiKey: "k", secret: "correct" });
  });

  it("chat needs both keys", () => {
    process.env.NEXT_PUBLIC_STREAM_CHAT_API_KEY = "k";
    expect(isStreamChatConfigured()).toBe(false);
    process.env.STREAM_CHAT_SECRET_KEY = "s";
    expect(isStreamChatConfigured()).toBe(true);
  });
});

describe("lazyClient", () => {
  it("does not construct until first use and binds methods", () => {
    const factory = jest.fn(() => ({ value: 2, double(this: { value: number }) { return this.value * 2; } }));
    const client = lazyClient(factory);
    expect(factory).not.toHaveBeenCalled();
    expect(client.double()).toBe(4);
  });

  it("surfaces the typed error only when used", () => {
    const client = lazyClient<{ call: () => void }>(() => { throw new StreamNotConfiguredError("video"); });
    expect(() => client.call()).toThrow(StreamNotConfiguredError);
  });
});
