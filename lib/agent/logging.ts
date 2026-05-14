/**
 * Structured logging for agent API routes.
 *
 * Emits one-line JSON to stderr (error) / stdout (info, warn) so Vercel log
 * aggregation picks up each field as searchable metadata. Replace ad-hoc
 * `console.error("agent X failed:", e)` with `logAgentEvent("x_failed", {...})`
 * so failures include request context (eventRef, userId, keyId, status).
 *
 * Shape:
 *   { timestamp, level, event, error_message?, error_stack?, ...context }
 */

type LogLevel = "info" | "warn" | "error";

export type AgentLogContext = {
  eventId?: string;
  eventRef?: string;
  userId?: string;
  keyId?: string;
  scope?: string;
  status?: number;
  route?: string;
  [key: string]: unknown;
};

export function logAgentEvent(
  event: string,
  context: AgentLogContext = {},
  error?: unknown,
  level: LogLevel = "error"
): void {
  const payload: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...context,
  };

  if (error !== undefined) {
    if (error instanceof Error) {
      payload.error_message = error.message;
      payload.error_stack = error.stack;
      payload.error_name = error.name;
    } else {
      payload.error_message = String(error);
    }
  }

  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
