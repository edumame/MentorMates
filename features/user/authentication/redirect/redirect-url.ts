export const RETURN_URL_STORAGE_KEY = "returnUrl";
export const LAST_VISITED_URL_STORAGE_KEY = "lastVisitedUrl";

const FALLBACK_ORIGIN = "https://mentor-mates.local";

const BLOCKED_REDIRECT_PATHS = [
  /^\/auth(?:\/|$)/,
  /^\/login(?:\/|$)/,
  /^\/signup(?:\/|$)/,
  /^\/confirmation(?:\/|$)/,
  /^\/onboarding(?:\/|$)/,
  /^\/reset-password(?:\/|$)/,
  /^\/checkout(?:\/|$)/,
  /^\/return(?:\/|$)/,
];

export function normalizeInternalPath(
  value: string | null | undefined,
  origin?: string
): string | null {
  const rawValue = value?.trim();
  if (!rawValue || rawValue.startsWith("//")) return null;

  try {
    if (rawValue.startsWith("/")) {
      const url = new URL(rawValue, origin ?? FALLBACK_ORIGIN);
      return `${url.pathname}${url.search}${url.hash}`;
    }

    if (!origin) return null;

    const url = new URL(rawValue);
    if (url.origin !== origin) return null;

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function isBlockedRedirectPath(path: string): boolean {
  const normalizedPath = normalizeInternalPath(path);
  if (!normalizedPath) return true;

  const { pathname } = new URL(normalizedPath, FALLBACK_ORIGIN);
  return BLOCKED_REDIRECT_PATHS.some((pattern) => pattern.test(pathname));
}

export function getSafeRedirectPath(
  value: string | null | undefined,
  origin?: string
): string | null {
  const normalizedPath = normalizeInternalPath(value, origin);
  if (!normalizedPath || isBlockedRedirectPath(normalizedPath)) return null;

  return normalizedPath;
}
