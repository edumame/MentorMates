# Internal Jev proxy (`POST /api/internal/jev`)

Invite-gated, rate-limited pass-through to Typesafe's Jev API (`POST https://api.typesafe.ai/v1/systemone`). Built so a few people can try Jev through MentorMates while the Typesafe key stays on the server, with per-key limits and instant revocation.

## Playground (what we actually send people)

`https://www.mentormates.ai/internal/jev?invite=<code>` renders a small page: paste your MentorMates API key (kept in the browser's localStorage only), type a question, see Jev's answer, latency, and calls left this minute. An invalid, revoked, expired, or exhausted invite renders the normal 404 page, so the URL is not discoverable. `robots: noindex`.

Files: `app/internal/jev/page.tsx` (server-side invite check), `components/internal/jev-playground.tsx`, `lib/internal/jev-client.ts` (tests next to each).

## How a caller uses it (API)

Same body as Typesafe's `/v1/systemone`, minus `model` (pinned server-side):

```bash
curl -s "https://www.mentormates.ai/api/internal/jev?invite=<code>" \
  -H "Authorization: Bearer mm_sk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "state": "Help! My payouts have been failing for 3 days.",
    "questions": {
      "is_urgent": { "type": "noul", "instructions": "Does this convey urgency?" },
      "department": { "type": "choice", "instructions": "Which team?", "criteria": { "billing": null, "technical": null, "sales": null } }
    }
  }'
```

- `invite` can be a query param (the link we hand out) or an `x-invite-code` header.
- The Bearer token is any MentorMates agent API key (Profile > API Keys).
- `state` is the text/object/array to evaluate. `questions` is a map of up to 10 named questions of type `noul` (yes/no, returns a 0 to 1 probability), `choice` (needs `criteria` map of options), or `score` (needs `criteria` array of at least 2 ordered levels). Under 32 KB.
- The response is Typesafe's, unchanged: `answers.<id>.noul | choice + probabilities + confidence | score`, plus `usage`.
- Limit: `INTERNAL_JEV_RATE_LIMIT` calls per minute per key (default 5). Over the limit returns 429 with `Retry-After`.
- Without a valid invite the route answers 404, so it is not discoverable.

## Server config (Vercel env)

- `TYPESAFE_API_KEY` — the Typesafe key (`apikey_…`). Jeffery's for now; it never leaves the server and can be rotated at any time.
- `JEV_MODEL` — defaults to `jev-latest`.
- `INTERNAL_JEV_RATE_LIMIT` — defaults to `5`.

## Issuing an invite

Run in the Supabase SQL editor (service role):

```sql
insert into public.internal_invites (code, label, service, max_uses, expires_at)
values ('jev-aikagra-0919', 'Aikagra (SEA Hacks winner)', 'jev', 500, now() + interval '30 days')
returning code;
```

Hand out: `https://www.mentormates.ai/internal/jev?invite=jev-aikagra-0919` (the playground) plus "create an API key in your MentorMates profile". Programmatic callers use the same code against `/api/internal/jev`.

Revoke: `update public.internal_invites set revoked_at = now() where code = '...';` Revoking the caller's `agent_api_keys` row also cuts them off immediately.

## Usage log

`public.internal_api_usage` has one row per forwarded call: key, invite, upstream status, latency, tokens. No prompt bodies are stored.

```sql
select i.label, count(*) calls, avg(u.latency_ms)::int avg_ms, max(u.created_at) last_call
from internal_api_usage u join internal_invites i on i.id = u.invite_id
group by i.label order by calls desc;
```

## Files

- `app/api/internal/jev/route.ts` — the route (tests: `route.test.ts`)
- `lib/internal/jev.ts` — invite check, rate-limit decision, payload validation (tests: `jev.test.ts`)
- `supabase/migrations/20260919_add_internal_invites_and_usage.sql` — tables + RLS + `increment_internal_invite_uses()`
