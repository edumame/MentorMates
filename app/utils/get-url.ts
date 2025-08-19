export function getURL(requestOrUrl?: Request | URL | string): string {
  // 1) Prefer explicit public override for client and server
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    undefined;

  // 2) On the server, Vercel exposes the current deployment host (including Preview)
  const vercel = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : undefined;

  // 3) Derive origin from the request (server route handlers)
  let originFromRequest: string | undefined;
  if (requestOrUrl && typeof window === "undefined") {
    const raw =
      typeof requestOrUrl === "string"
        ? requestOrUrl
        : requestOrUrl instanceof URL
        ? requestOrUrl.toString()
        : requestOrUrl.url;
    try {
      originFromRequest = new URL(raw).origin;
    } catch {
      // noop
    }
  }

  // 4) On the client, fall back to window origin
  let clientOrigin: string | undefined;
  if (typeof window !== "undefined") {
    clientOrigin = window.location.origin;
  }

  const chosen = fromEnv || vercel || originFromRequest || clientOrigin || "http://localhost:3000";
  return chosen.endsWith("/") ? chosen.slice(0, -1) : chosen;
}

