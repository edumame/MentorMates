/**
 * Error for a failed API response: the body's `error` message when it has
 * one, otherwise `fallback` (non-JSON bodies, empty messages).
 */
export async function readApiError(response: Response, fallback: string): Promise<Error> {
  const body = await response.json().catch(() => null);
  const message =
    body && typeof body.error === "string" && body.error.trim() ? body.error : fallback;
  return new Error(message);
}

/** Normalizes a thrown value (e.g. a network failure) to an Error. */
export function toError(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(fallback);
}
