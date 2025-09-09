-- Add sponsorship_tiers JSONB column to events for event-specific sponsorships
alter table if exists public.events
add column if not exists sponsorship_tiers jsonb;

-- Optional: simple check to ensure it's a JSON object if provided
alter table if exists public.events
add constraint events_sponsorship_tiers_is_object
check (
  sponsorship_tiers is null
  or jsonb_typeof(sponsorship_tiers) = 'object'
);

-- Example structure (documentation):
-- {
--   "tiers": [
--     { "id": "bronze", "label": "Bronze", "price": 50000, "benefits": ["Logo on site", "Opening mention"], "sort": 1 },
--     { "id": "silver", "label": "Silver", "price": 100000, "benefits": ["Medium logo", "Social shoutout", "Table"], "sort": 2 },
--     { "id": "gold", "label": "Gold", "price": 200000, "benefits": ["Prominent logo", "Announcement", "Premium table", "Present a prize"], "sort": 3 }
--   ]
-- }

