/** Headers for every Next.js server request to the screen vision worker. */
export function screenVisionWorkerHeaders(): Record<string, string> {
  return {
    "content-type": "application/json",
    "x-worker-secret": process.env.SCREEN_VISION_WORKER_SECRET ?? "",
  };
}
