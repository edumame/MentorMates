import "server-only";
import { StreamClient } from "@stream-io/node-sdk";

let streamVideoClient: StreamClient | null = null;

/**
 * Returns a configured Stream Video client.
 *
 * Important:
 * - We create it lazily (at request-time) so `next build` doesn't crash in
 *   environments where Stream env vars are not present.
 * - We support both `STREAM_VIDEO_SECRET_KEY` (correct) and the legacy typo
 *   `STREAM_VIDEO_SCRET_KEY` to reduce the chance of breaking existing deploys.
 */
export function getStreamVideoClient(): StreamClient {
  if (streamVideoClient) return streamVideoClient;

  const apiKey = process.env.NEXT_PUBLIC_STREAM_VIDEO_API_KEY;
  const secret =
    process.env.STREAM_VIDEO_SECRET_KEY ?? process.env.STREAM_VIDEO_SCRET_KEY;

  if (!apiKey || !secret) {
    throw new Error("Stream Video API key/secret is not configured");
  }

  streamVideoClient = new StreamClient(apiKey, secret);
  return streamVideoClient;
}
