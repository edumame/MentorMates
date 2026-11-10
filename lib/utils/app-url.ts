/**
 * Absolute base URL for links/redirects the server hands to third parties
 * (Stripe return/success URLs). Uses NEXT_PUBLIC_APP_URL, never a
 * caller-supplied Origin/Host header; the fallback is only for local dev.
 */
export function getAppBaseUrl(fallbackOrigin?: string | null): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  for (const candidate of [configured, fallbackOrigin]) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
    } catch {
      // try the next candidate
    }
  }
  return "http://localhost:3000";
}
