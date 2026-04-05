/**
 * Helper for reading i18n JSONB fields with graceful fallback.
 *
 * Usage:
 *   const name = getLocalizedField(event, "event_name", currentLocale);
 *   // -> event.event_name_i18n[currentLocale] || event.event_name_i18n[defaultLocale] || event.event_name
 *
 * This is the single read path for any *_i18n JSONB column so we never
 * show an empty string to users if a translation is missing.
 */

type I18nMap = Record<string, string | null | undefined> | null | undefined;

export interface LocalizableRow {
  [key: string]: unknown;
}

/**
 * Read a localized field from a row with fallback chain:
 *   1. row[`${field}_i18n`][locale]
 *   2. row[`${field}_i18n`][fallbackLocale]
 *   3. row[field] (original, non-localized column)
 *   4. "" (empty string)
 */
export function getLocalizedField(
  row: LocalizableRow | null | undefined,
  field: string,
  locale: string,
  fallbackLocale: string = "en"
): string {
  if (!row) return "";

  const i18nKey = `${field}_i18n`;
  const i18nMap = row[i18nKey] as I18nMap;

  // Check for the requested locale
  if (i18nMap && typeof i18nMap === "object") {
    const value = i18nMap[locale];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
    // Try the fallback locale
    const fallback = i18nMap[fallbackLocale];
    if (typeof fallback === "string" && fallback.trim().length > 0) {
      return fallback;
    }
  }

  // Fall back to the original non-i18n column
  const original = row[field];
  if (typeof original === "string") return original;

  return "";
}

/**
 * Write a localized value into the i18n JSONB map without losing other locales.
 * Returns a new map that should be written back to the *_i18n column.
 *
 * Usage:
 *   const newMap = setLocalizedField(event.event_name_i18n, "zh", "AI黑客马拉松");
 *   await supabase.from("events").update({ event_name_i18n: newMap }).eq("event_id", id);
 */
export function setLocalizedField(
  existing: I18nMap,
  locale: string,
  value: string
): Record<string, string> {
  const map = existing && typeof existing === "object" ? { ...existing } : {};
  if (value.trim().length > 0) {
    map[locale] = value;
  } else {
    delete map[locale];
  }
  // Filter out null/undefined entries
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) {
    if (typeof v === "string") cleaned[k] = v;
  }
  return cleaned;
}

/**
 * List all locales that have a translation for the given row + field.
 * Useful for UI that shows "This event has translations in: en, zh, es".
 */
export function getAvailableLocales(
  row: LocalizableRow | null | undefined,
  field: string
): string[] {
  if (!row) return [];
  const i18nMap = row[`${field}_i18n`] as I18nMap;
  if (!i18nMap || typeof i18nMap !== "object") return [];
  return Object.entries(i18nMap)
    .filter(([, v]) => typeof v === "string" && v.trim().length > 0)
    .map(([k]) => k);
}
