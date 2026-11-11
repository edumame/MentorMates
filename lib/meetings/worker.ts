/** Shared only by server routes; never send this credential to the browser. */
export function workerHeaders() {
  const secret = process.env.SCREEN_VISION_WORKER_SECRET;
  if (!secret) throw new Error('Worker authentication is not configured');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` };
}

/**
 * Turn a worker pause/resume reply into the route response. A 2xx alone is not
 * a confirmation: an older worker answers 200 with `ok: false` while captions
 * are still starting, so the body's `ok` must be true too. Worker error details
 * are not passed to the browser.
 */
export async function workerControlResult(response: Response) {
  const body = (await response.json().catch(() => null)) as
    | { ok?: unknown; waitingForCaptions?: unknown }
    | null;
  if (response.ok && body?.ok === true) {
    return { body: { ok: true }, status: 200 };
  }
  if (response.status === 503 || body?.waitingForCaptions === true) {
    return {
      body: { ok: false, error: 'Agent is still starting', waitingForCaptions: true },
      status: 503,
    };
  }
  return { body: { ok: false, error: 'Worker operation failed' }, status: 502 };
}
