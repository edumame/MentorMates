-- Add session_caps JSONB column to events for event-specific sponsorships
alter table if exists public.events
add column if not exists session_caps jsonb;

-- Optional: simple check to ensure it's a JSON object if provided
alter table if exists public.events
add constraint events_session_caps_is_object
check (
  session_caps is null
  or jsonb_typeof(session_caps) = 'object'
);

-- Example structure (documentation):
-- {
--  "default": 3,
--  "agent_caps": {
--    "a5887345-7749-4fad-af42-3128fb65298e": null,
--    "c1ded1d4-88d0-4741-adfa-71cbe0f5d702": 2
--  }
-- }

-- default: Default cap per user (Leave null for no cap).
-- agent_caps: Per-agent caps (Set overrides for specific agents. Leave blank/null for default).

