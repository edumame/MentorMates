// Where the bottom-right support circle (and shipcue's panel above it) sits.
// Some pages have their own controls in that corner, so it moves up there.

/**
 * - "chat": the chat composer fills the bottom of the screen on every size.
 * - "mobile-bar": a sticky Submit bar covers the bottom on phones only.
 * - "default": nothing in the corner.
 */
export type FloatingPlacement = "default" | "chat" | "mobile-bar";

// NewProjectSubmissionFormSinglePage's sticky Submit bar (sm:hidden).
const MOBILE_BAR_PATHS = [/^\/projects\/submit\/?$/];

export function floatingPlacement(pathname: string | null | undefined): FloatingPlacement {
  if (!pathname) return "default";
  if (pathname.startsWith("/chat")) return "chat";
  if (MOBILE_BAR_PATHS.some((re) => re.test(pathname))) return "mobile-bar";
  return "default";
}
