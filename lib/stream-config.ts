// Stream (video + chat) is optional infrastructure: local dev, previews and
// self-hosted installs may run without it. Clients are created lazily so a
// missing key only fails the Stream-dependent call, never module import.

export class StreamNotConfiguredError extends Error {
  constructor(readonly service: "video" | "chat") {
    super(
      service === "video"
        ? "Video calls are not configured"
        : "Chat is not configured"
    );
    this.name = "StreamNotConfiguredError";
  }
}

export const STREAM_UNAVAILABLE_MESSAGES = {
  video: "Video calls are not configured",
  chat: "Chat is not configured",
} as const;

const read = (value: string | undefined) => value?.trim() || undefined;

/**
 * STREAM_VIDEO_SECRET_KEY is the correct name. STREAM_VIDEO_SCRET_KEY (the
 * historical misspelling) is still accepted so existing deployments keep
 * working; remove the fallback once every environment has been renamed.
 */
export function streamVideoCredentials() {
  const apiKey = read(process.env.NEXT_PUBLIC_STREAM_VIDEO_API_KEY);
  const secret =
    read(process.env.STREAM_VIDEO_SECRET_KEY) ??
    read(process.env.STREAM_VIDEO_SCRET_KEY);
  return apiKey && secret ? { apiKey, secret } : null;
}

export function streamChatCredentials() {
  const apiKey = read(process.env.NEXT_PUBLIC_STREAM_CHAT_API_KEY);
  const secret = read(process.env.STREAM_CHAT_SECRET_KEY);
  return apiKey && secret ? { apiKey, secret } : null;
}

export const isStreamVideoConfigured = () => streamVideoCredentials() !== null;
export const isStreamChatConfigured = () => streamChatCredentials() !== null;

/**
 * Lazily delegates every property access to the client returned by `get`, so
 * existing `streamVideo.foo()` call sites (and their jest mocks) keep working
 * while construction is deferred to first use.
 */
export function lazyClient<T extends object>(get: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      const client = get();
      const value = Reflect.get(client, prop, client);
      return typeof value === "function" ? value.bind(client) : value;
    },
  });
}
