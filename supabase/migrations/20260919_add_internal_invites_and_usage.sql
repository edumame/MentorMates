-- Internal, invite-gated API proxies (first service: Typesafe Jev via OpenRouter).
-- An invite is a shareable code tied to a specific link; a caller also needs a
-- normal MentorMates agent API key (agent_api_keys). Usage rows drive the
-- per-key rate limit (default 5 calls / minute) and give us a revocable audit trail.

create table if not exists public.internal_invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  service text not null default 'jev',
  label text,
  max_uses integer,                      -- null = unlimited forwarded calls
  uses integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.internal_api_usage (
  id bigserial primary key,
  service text not null,
  key_id uuid references public.agent_api_keys(id) on delete set null,
  invite_id uuid references public.internal_invites(id) on delete set null,
  status integer,
  latency_ms integer,
  prompt_tokens integer,
  completion_tokens integer,
  created_at timestamptz not null default now()
);

create index if not exists internal_api_usage_key_window_idx
  on public.internal_api_usage (key_id, created_at desc);

-- Service role only. No anon/authenticated policies on purpose.
alter table public.internal_invites enable row level security;
alter table public.internal_api_usage enable row level security;

create or replace function public.increment_internal_invite_uses(p_invite_id uuid)
returns void language sql security definer as $$
  update public.internal_invites set uses = uses + 1 where id = p_invite_id;
$$;
