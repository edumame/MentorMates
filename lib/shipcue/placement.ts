// Where the two bottom-right buttons sit. shipcue's report bubble takes the
// corner; the support button stacks directly above it. Some pages have their
// own controls in that corner, so both buttons move up together there.

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
