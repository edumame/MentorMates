import "server-only";
import { StreamClient } from "@stream-io/node-sdk";
import {
  lazyClient,
  StreamNotConfiguredError,
  streamVideoCredentials,
} from "@/lib/stream-config";

let client: StreamClient | null = null;

/** Throws StreamNotConfiguredError when the video keys are missing. */
export function getStreamVideo(): StreamClient {
  if (client) return client;
  const credentials = streamVideoCredentials();
  if (!credentials) throw new StreamNotConfiguredError("video");
  client = new StreamClient(credentials.apiKey, credentials.secret);
  return client;
}

export const streamVideo: StreamClient = lazyClient(getStreamVideo);
