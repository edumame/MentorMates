/**
 * Display columns for event listings. Listings are sent to the browser, so
 * keep this an explicit allowlist: `select("*")` would also ship
 * paywall_content and the submitter contact fields to every viewer.
 */
export const EVENT_LISTING_COLUMNS =
  "event_id, slug, event_name, event_blurb, event_description, event_date, location, visibility, cover_image_url, event_type, featured, approval_status, external_url, external_redirect_enabled" as const;
