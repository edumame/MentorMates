import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";
import { locales, defaultLocale } from "./config";

/**
 * Routing configuration for next-intl.
 * - `localePrefix: "as-needed"` — the default locale URL is unprefixed (/events),
 *   other locales are prefixed (/zh/events, /es/events)
 *
 * Change to "always" if we want strict /en/events for consistency with zh/es.
 */
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "as-needed",
});

/**
 * Locale-aware drop-in replacements for next/link, next/navigation's useRouter,
 * redirect, and usePathname. Use these throughout the app instead of the
 * Next.js primitives so the locale is preserved on navigation.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
