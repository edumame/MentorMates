/**
 * Every top-level URL segment served by the App Router (including the
 * children of route groups such as `app/(static)`) plus rewrite sources from
 * next.config.mjs. A path whose first segment is not listed cannot match any
 * route, so Next renders app/not-found.tsx: AuthProvider must let that render
 * instead of bouncing signed-out visitors to "/" (PUB-009).
 *
 * Keep in sync with the app directory; app-route-segments.test.ts fails when a
 * top-level route is added or removed.
 */
export const APP_ROUTE_SEGMENTS: ReadonlySet<string> = new Set([
  // app/
  "admin",
  "agents",
  "ai-vibe-guide",
  "ai-vibe-masterclass",
  "api",
  "article",
  "auth",
  "call",
  "certificate",
  "chat",
  "checkin",
  "checkout",
  "claim-ticket",
  "confirmation",
  "curriculum",
  "devpost-integration",
  "events",
  "feedback",
  "internal",
  "join-project",
  "keys",
  "learn",
  "login",
  "onboarding",
  "profile",
  "project",
  "projects",
  "reset-password",
  "resources",
  "return",
  "select-role",
  "ticket",
  // app/(static)/
  "about",
  "blog",
  "faq",
  "help",
  "host",
  "join",
  "license",
  "previous-contributors",
  "privacy",
  "research",
  "support",
  "terms",
  // next.config.mjs rewrites
  "judge-certificate",
]);

/** True when no App Router route can match this path (it will render 404). */
export function isUnroutablePath(pathname: string) {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  if (!firstSegment) return false; // "/"
  return !APP_ROUTE_SEGMENTS.has(firstSegment);
}
