// Every events column a signed-in user may read (PUB-002). paywall_content is
// members-only and is read through the get_event_paywall_content() RPC; never
// select("*") on events (it fails: authenticated has column-level grants).
// rejection_reason is not readable either (XL-014): managers read it through
// the get_event_rejection_reasons() RPC.
// Keep in sync with supabase/migrations/202611080302_b_round2.sql and
// 202611080603_e_events_moderation_column_privacy.sql.
export const EVENT_ROW_COLUMNS =
  "event_id, event_name, event_date, location, event_description, event_schedule, event_prizes, event_resources, created_at, rules, cover_image_url, scoring_config, event_blurb, submission_time_start, submission_time_cutoff, visibility, role_labels, slug, event_type, paid, stripe_price_id, price, faq, participant_capacity, sponsorship_tiers, owner_id, finalist_recommendation_enabled, featured, approval_status, session_caps, require_participant_approval, external_url, external_redirect_enabled, team_formation_enabled, featured_requested, voting_opens_at, voting_closes_at";
