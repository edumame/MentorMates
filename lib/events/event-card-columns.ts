// Columns needed to render an event card/row in listings (/events, /api/events).
// Keep listings on this explicit list instead of select("*"): the events row
// also holds member-only and admin-only data (paywall_content,
// rejection_reason) that must not be shipped to every browser (PUB-003).
export const EVENT_CARD_COLUMNS =
  "event_id, slug, event_name, event_blurb, event_description, event_date, location, visibility, cover_image_url, event_type, paid, participant_capacity, featured, approval_status, created_at, external_url, external_redirect_enabled, role_labels";

// Listings only use event_description as a one-line fallback summary when an
// event has no blurb (EventCard, EventRow), but full descriptions run to
// several KB each. Sending every one of them made /events slow to open.
export const EVENT_LIST_SUMMARY_MAX_LENGTH = 300;

export function toEventListSummary(
  description: string | null | undefined
): string | null {
  if (description == null) return null;
  const collapsed = description.replace(/\s+/g, " ").trim();
  if (collapsed.length <= EVENT_LIST_SUMMARY_MAX_LENGTH) return collapsed;
  return `${collapsed.slice(0, EVENT_LIST_SUMMARY_MAX_LENGTH - 1).trimEnd()}…`;
}

/** Replaces the full description with the short summary listings show. */
export function withListSummary<T extends { event_description?: string | null }>(
  event: T
): T {
  return { ...event, event_description: toEventListSummary(event.event_description) };
}
