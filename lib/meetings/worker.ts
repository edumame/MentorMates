/** Shared only by server routes; never send this credential to the browser. */
export function workerHeaders() {
  const secret = process.env.SCREEN_VISION_WORKER_SECRET;
  if (!secret) throw new Error('Worker authentication is not configured');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` };
}
