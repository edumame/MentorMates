import type { Json } from "@/lib/database.types";

export class ModelApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public upstreamStatus: number | null = null,
    public retryAfter: string | null = null,
    public responseBody: Json | null = null,
  ) {
    super(message);
  }
}

export function errorBody(error: ModelApiError, requestId?: string) {
  return {
    error: { code: error.code, message: error.message },
    ...(requestId ? { request_id: requestId } : {}),
  };
}

export function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

/** Bound the stream itself: Content-Length is neither required nor trusted. */
export async function readBoundedText(
  message: Request | Response,
  maxBytes: number,
  signal: AbortSignal,
) {
  if (Number(message.headers.get("content-length")) > maxBytes) {
    void message.body?.cancel().catch(() => {});
    throw new ModelApiError(
      413,
      "body_too_large",
      "Request or response exceeds the size limit.",
    );
  }
  const reader = message.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  const abort = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    signal.throwIfAborted();
    while (true) {
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        void reader.cancel().catch(() => {});
        throw new ModelApiError(
          413,
          "body_too_large",
          "Request or response exceeds the size limit.",
        );
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } finally {
    signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}

// Provider errors can echo credentials. Never persist or return either bearer secret.
export function redactSecrets<T>(body: T, secrets: string[]): T {
  const serialized = JSON.stringify(body);
  if (serialized === undefined) return body;
  let sanitized = serialized;
  for (const secret of secrets.filter(Boolean)) {
    sanitized = sanitized
      .split(JSON.stringify(secret).slice(1, -1))
      .join("[REDACTED]");
  }
  return JSON.parse(sanitized) as T;
}
