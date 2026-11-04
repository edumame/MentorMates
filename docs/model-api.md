# Model API gateway

The developer console is at `/developers` (also linked as **Model API** in the sidebar). Visitors must sign in or create a MentorMates account before they can access it. Anonymous Supabase sessions cannot create keys. Model keys are separate from event-agent keys and do not grant access to event administration.

## Setup

1. Apply `supabase/migrations/20260919_model_gateway.sql` to the app's Supabase project through your normal migration process. It creates model keys, request history, account counters, row-level policies, and the privileged admission function. The migration requires the standard Supabase `auth.users`, `auth.uid()`, and `anon`, `authenticated`, `service_role` roles.
2. Add `TYPESAFE_API_KEY` to the server environment (for local development, `.env.local`). Obtain this provider key from TypeSafe. Never prefix it with `NEXT_PUBLIC_`.
3. The existing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` must be configured. Restart the app after changing environment variables.
4. Sign in at `/login?returnUrl=%2Fdevelopers`, create a model API key, and copy it when displayed. Only its SHA-256 hash and a display prefix are retained by the gateway. A lost key must be replaced; a revoked key stops admitting new requests immediately. Already admitted requests may finish.

Optional server settings:

| Variable | Default | Meaning |
| --- | --- | --- |
| `MODEL_API_REQUESTS_PER_MINUTE` | `60` | Account allowance per fixed minute, shared by all keys |
| `MODEL_API_REQUESTS_PER_DAY` | `1000` | Account allowance per UTC calendar day, shared by all keys |
| `MODEL_API_TIMEOUT_MS` | `15000` | Upstream timeout covering connection and response body; maximum 30000 |

Limits are checked transactionally in PostgreSQL. Validation failures and upstream failures consume an admitted request. Rejected over-quota requests are recorded but do not consume additional allowance. Key management and the static model listing do not consume inference allowance.

## Make a request

Set `MENTORMATES_MODEL_API_KEY` in the calling application's server environment to the key created in the console. Use your app's origin below:

```sh
curl https://YOUR_DOMAIN/api/v1/systemone \
  -H "Authorization: Bearer $MENTORMATES_MODEL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "jev-latest",
    "state": "Please help me reset my password.",
    "questions": {
      "needs_help": {
        "type": "noul",
        "instructions": "Is the user asking for help?"
      }
    }
  }'
```

The gateway accepts Jev's `state` and `questions` contract. Omitting `model` selects `jev-latest`. Supported model IDs are `jev-latest`, `jev-preview`, and `jev-1.13.0`; aliases may change upstream. Responses report the resolved model and include typed answers and token usage. The registry can be inspected with `GET /api/v1/models` using the same bearer key.

See [TypeSafe's HTTP reference](https://docs.typesafe.ai/api) and [structured criteria](https://docs.typesafe.ai/primitives/advanced) for Noul, Choice, and Score formats. The gateway limits requests to 256 KiB and JSON nesting to 32 levels, allows 10 seconds to read the body, and bounds provider responses to 2 MiB. TypeSafe's token/context limits still apply. Requests must include at least one question; Choice and Score require at least two options/levels.

## Request history and errors

Authenticated inference attempts are stored with the account, key ID, full request and response JSON, requested/resolved model, HTTP/upstream status, timestamps, duration, and token usage when available. Malformed JSON is stored as text. Authorization headers are never saved, and exact occurrences of the caller's bearer key or the configured provider key are redacted from stored content and returned model responses.

For provider errors, history contains the provider response body while the public response uses a stable error envelope. Oversized, unreadable, or timed-out input bodies are not saved; their rejection is recorded with a null body. Oversized provider responses are rejected without retaining the oversized content. Calls rejected for missing/invalid keys have no account history record. `GET /api/v1/models` is a local registry lookup and is not included in inference history.

Every inference response includes `X-Request-Id`. Gateway errors have this form:

```json
{
  "error": { "code": "rate_limit_exceeded", "message": "Your account's model request limit has been reached." },
  "request_id": "..."
}
```

| Status | Meaning |
| --- | --- |
| 400 | Invalid JSON, invalid question shape, or unsupported model |
| 401 | Missing, invalid, revoked, or expired model key |
| 413 | Request body exceeds the byte limit |
| 422 | Upstream rejected the input |
| 429 | Account or provider allowance exceeded; honor `Retry-After` when supplied |
| 502 | Upstream unavailable, rejected its server credential, or returned an invalid/oversized response |
| 503 | Gateway storage/configuration unavailable or provider overloaded |
| 504 | Upstream timeout |

The gateway saves a pending request before contacting the provider. If that write fails, no inference is attempted. It then waits for the completion update before responding. If the completion update fails, it preserves the original inference result and returns `X-Request-Log-Status: incomplete`; the durable history row stays pending. This avoids turning successful inference into a retryable error. Completed records return `X-Request-Log-Status: complete`. Process termination after admission can also leave a pending record; pending does not prove that inference never ran.

Inference is not automatically retried or cached. A caller retry is a new request and may incur another provider charge. The request ID is for correlation, not an idempotency key. Limits use fixed windows, not a rolling average. There is no billing integration in this version.

History is retained until its owning account is deleted or an operator applies a retention policy. No automatic retention deletion is enabled. The console discloses that inputs and outputs are saved. Key and history lists use indexed cursor pagination (25 records per page); full bodies are fetched only when opening a request. Full request bodies for over-quota attempts are also stored, so storage grows with authenticated attempts, not only completed inference.

## Internal management API

These routes require a verified browser account session; model bearer keys do not grant management access. All responses disable caching. Mutations require same-origin JSON requests.

| Route | Action |
| --- | --- |
| `GET /api/model-api/keys?cursor=...` | List the account's key metadata, never hashes or secrets |
| `POST /api/model-api/keys` | Create using `{ "label": "My app", "expires_at": null }`; secret returned once |
| `DELETE /api/model-api/keys` | Revoke using `{ "key_id": "uuid" }` |
| `GET /api/model-api/requests?cursor=...` | List request metadata |
| `GET /api/model-api/requests?id=uuid` | Read one owned request including bodies |

Database grants additionally prevent clients from creating keys, modifying history, resetting quotas, or calling the privileged admission function through Supabase directly. Key hashes are not readable by authenticated clients. The service role is used only after server-side authentication, with explicit account filters.

## Extend and test

`lib/model-api/providers.ts` defines a small `ModelProvider` contract and registry. Add another adapter implementing the System One contract and register its model IDs there. Providers with a different interface (for example, streaming chat) should get their own capability route and validator while reusing account authentication, admission, pagination, and recording. Do not silently treat Jev as a text-generation model.

```sh
pnpm exec jest --runInBand lib/model-api app/api/v1 app/developers lib/agent/auth.test.ts app/api/agent/__tests__/agent-api.test.ts
pnpm run test:model-api:db
```

The database suite executes the real migration in isolated PGlite PostgreSQL, then checks grants, row-level account isolation, admission/rollover/rollback, revocation, and account cleanup. It needs neither Docker nor remote credentials. PGlite has one connection, so these tests do not simulate concurrent transactions on separate PostgreSQL connections. Row locks in the admission function enforce serialization in the deployed database. Provider tests mock HTTP and do not incur inference charges.

The TypeSafe Codex skill is installed locally at `.agents/skills/typesafe-ai/SKILL.md`, tracked by `skills-lock.json`.
