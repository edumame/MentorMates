/**
 * Locales the app supports, shared by server code until the i18n foundation
 * (#662, `i18n/config.ts`) lands on main. Keep this list in sync with
 * `messages/<locale>.json`; when #662 merges, re-export its `locales` here.
 */
export const SUPPORTED_LOCALES = ["en", "zh", "es"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * English language names used in server-side AI prompts. Only these fixed
 * strings ever reach a system prompt, never the caller's locale value.
 */
export const LOCALE_LANGUAGE_NAMES: Record<SupportedLocale, string> = {
  en: "English",
  zh: "Simplified Chinese",
  es: "Spanish",
};
