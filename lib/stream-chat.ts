import "server-only";

import { StreamChat } from "stream-chat";
import {
  lazyClient,
  StreamNotConfiguredError,
  streamChatCredentials,
} from "@/lib/stream-config";

/** Throws StreamNotConfiguredError when the chat keys are missing. */
export function getStreamChat(): StreamChat {
  const credentials = streamChatCredentials();
  if (!credentials) throw new StreamNotConfiguredError("chat");
  // getInstance memoises the server client.
  return StreamChat.getInstance(credentials.apiKey, credentials.secret);
}

export const streamChat: StreamChat = lazyClient(getStreamChat);
