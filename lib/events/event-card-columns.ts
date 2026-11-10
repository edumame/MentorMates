// Columns needed to render an event card/row in listings (/events, /api/events).
// Keep listings on this explicit list instead of select("*"): the events row
// also holds member-only and admin-only data (paywall_content,
// rejection_reason) that must not be shipped to every browser (PUB-003).
export const EVENT_CARD_COLUMNS =
  "event_id, slug, event_name, event_blurb, event_description, event_date, location, visibility, cover_image_url, event_type, paid, participant_capacity, featured, approval_status, created_at, external_url, external_redirect_enabled, role_labels";
