/**
 * i18n configuration for MentorMates.
 *
 * - `locales` — the list of supported locales, ordered by priority
 * - `defaultLocale` — fallback locale when no Accept-Language / cookie match
 * - `localeLabels` — display names for the language switcher UI
 *
 * To add a new locale:
 * 1. Add the locale code here
 * 2. Create `messages/<locale>.json` with translations
 * 3. Add the display label below
 */

export const locales = ["en", "zh", "es"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeLabels: Record<Locale, string> = {
  en: "English",
  zh: "简体中文",
  es: "Español",
};

/**
 * Feature flag for gating the i18n rollout during development.
 * Set NEXT_PUBLIC_I18N_ENABLED=1 to enable locale routing.
 * When false, the middleware passes requests through unchanged.
 */
export const i18nEnabled = process.env.NEXT_PUBLIC_I18N_ENABLED === "1";
