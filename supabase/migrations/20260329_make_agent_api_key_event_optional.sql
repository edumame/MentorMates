-- Allow agent API keys to be reused across multiple events.
-- Event authorization now happens per request via the event_id query parameter.

ALTER TABLE public.agent_api_keys
ALTER COLUMN event_id DROP NOT NULL;
