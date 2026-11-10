// Event URL slug rules (ORG-014). Slugs share the /events/<id> URL space with
// event UUIDs, so a UUID-shaped slug could shadow another event's UUID link.
export const EVENT_SLUG_MAX_LENGTH = 80;
export const EVENT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_SHAPED = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns a user-facing error for an invalid slug, or null when it is valid. */
export function getEventSlugError(slug: string): string | null {
  if (!slug) return "URL slug cannot be empty.";
  if (slug.length > EVENT_SLUG_MAX_LENGTH) {
    return `URL slug can be at most ${EVENT_SLUG_MAX_LENGTH} characters.`;
  }
  if (!EVENT_SLUG_PATTERN.test(slug)) {
    return "URL slug can only use lowercase letters, numbers and single hyphens.";
  }
  if (UUID_SHAPED.test(slug)) return "URL slug cannot look like an event ID.";
  return null;
}

/** Postgres unique-violation on events.slug → friendly copy. */
export function isDuplicateEventSlugError(error: { code?: string; message?: string } | null | undefined) {
  return Boolean(
    error && (error.code === "23505" || error.message?.toLowerCase().includes("events_slug_key")) &&
      (error.message ?? "").toLowerCase().includes("slug")
  );
}

export const DUPLICATE_EVENT_SLUG_MESSAGE = "This URL slug is already taken. Please choose another.";
