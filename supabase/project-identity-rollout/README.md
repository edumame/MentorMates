# Project identity migration rollout

These files have been written, **not executed**. No staging, production, or local
database was contacted to validate them. Application changes are a separate step.
The additive migrations alone do not close the current email exposure.

## Release order

| Release | Files | Prerequisite |
| --- | --- | --- |
| M1: expand | `../migrations/20260909000100_add_project_identity_storage.sql` through `20260909000400_add_project_identity_invitations.sql` | Confirm the deployed schema and rehearse the old application against the additive schema. |
| A1/A2: compatible app | Application work, not included here | Explicit public project/profile/feedback fields; UUID team UI and picker; both detail routes; compatible writes/invites; safe server adapter for legacy and UUID sources. |
| M2/A3: privacy | `M2_restrict_project_identity_exposure.sql` plus endpoint cutover | Compatible build and rollback build deployed; old email-returning servers, deployments, caches, roster/profile APIs, and invitation responses retired. **Does not require completed backfill.** |
| B1: paced backfill | Controlled calls to `project_identity_backfill_batch`, not a bulk SQL migration | Rehearsed worker with pacing, bounded retries, resource thresholds, and pause behavior. |
| M3: authority | `M3_enable_uuid_project_authorization.sql`, followed by individually reviewed conversions | Every existing project has initialized state; policy dependencies and concurrent edits tested. Unresolved projects can remain legacy while others convert. |
| A4/M4: contract | Contract-safe app, then `M4_remove_legacy_project_email_membership.sql` | Every project converted and verified; dependency inventory empty; rollback build no longer reads removed columns. |

Keep M2/M3/M4 **outside `supabase/migrations`** until their own releases. A normal
“apply pending migrations” deployment must never pick up those later stages early.
When promoting a stage, give it a fresh migration timestamp after all migrations
already deployed in both environments. Rehearse that exact promoted artifact.

Run the sequence independently in staging, then production, using the same
reviewed artifacts. Never copy UUID/email mappings from staging into production.
Check each environment's database reference, migration history, PostgreSQL version,
schema, RLS, grants, views/RPCs, API row limit, and application build first. The repo
targets PostgreSQL 15, but its historical migration files and dump do not prove
the deployed schema. Use the `postgres` migration role so definer ownership is
explicit. Keep `project_identity_private` outside exposed API schemas.

## Later-stage acknowledgements

Each deferred file starts a transaction and fails unless the deployment connection
has the following session settings. These are **release acknowledgements**, not
authentication or proof that tests ran; only the trusted deployment operator sets
them after collecting the required evidence. Set them on the same dedicated
connection before executing the stage. Reset/close the connection afterward.

| File | Required settings |
| --- | --- |
| M2 | `mentormates.identity_release = privacy`; `mentormates.compatible_build = <immutable safe build ID>`; `mentormates.identity_exposure_audited = true` |
| M3 | `mentormates.identity_release = members`; `mentormates.identity_authorization_audited = true` |
| M4 | `mentormates.identity_release = contract`; `mentormates.compatible_build = <immutable contract-safe rollback build ID>`; `mentormates.identity_contract_audited = true` |

The SQL additionally checks phase order, known policy drift, effective grants,
initialized/converted state, and contract dependencies. Unknown email-based
policies cause a failure requiring a reviewed replacement. Do not bypass those
checks or use `CASCADE` to force a migration through. Catalog/string checks do
not detect every dynamic SQL function, nested view, external endpoint, or cache;
the separate exposure/dependency audit is required.

Files use short migration lock/statement timeouts. A timeout rolls back that file;
investigate and retry later. Do not raise timeouts blindly against a busy database.
Do not bundle backfill or project conversion into the DDL transaction.

## Storage and operation contract

- `public.project_members` has UUID foreign keys, a project/user primary key, a
  reverse lookup index, and at most one lead. Deferred constraints require exactly
  one lead for a claimed UUID project, or zero for an explicitly unclaimed one.
- Private state is the authority marker: `legacy` or `members`. An empty or failed
  UUID lookup never falls back to old email data. M1 leaves existing public RLS and
  legacy grants in place; M3 replaces the membership authorization helper.
- Legacy writes synchronize a complete shadow set, including removals. Project
  creation, member changes, invitation consumption, backfill, and conversion lock
  the project before its state. Existing members retain `joined_at` during sync.
- Profiles are optional presentation data, not membership foreign keys. Account
  deletion is restricted while membership exists; handle lead transfer/removal in
  the account-deletion workflow. Deleting an invite recipient cannot turn a
  targeted invitation into a share invitation.
- M2 excludes `lead_email`, `teammates`, and old `lead_name` from browser reads and
  writes. It also hides `mentor_email` and old `mentor_name` on feedback, removes
  anonymous profile access, and retires the known email-bearing profile view.
  Own-profile/admin/organizer profile access remains governed by existing RLS.
- M4 removes only the two legacy membership columns. It retains restricted
  `lead_name`, private historical reconciliation, invitation records, source
  markers, and explicit errors for retired compatibility operations.

| RPC | Caller and behavior |
| --- | --- |
| `project_identity_read(p_project_ids, p_after, p_limit)` | Service only, **after** authorizing the requested projects with caller credentials. At most 100 IDs and 500 rows per page. Returns UUID/role, source, revision, unresolved count, and cursor; no profiles or emails. |
| `project_member_change(project, action, user)` | Authenticated user; actor is `auth.uid()`. `action` is `add`, `remove`, or `transfer`. Add/remove are idempotent. Only a lead or manager can transfer ownership; removing a lead is rejected. |
| `project_member_change_as(...)` | Service-only variant with a server-verified actor. Never expose an arbitrary client actor field through the server. |
| `project_create_with_lead(id, data)` | Authenticated user creates a draft with themselves as lead atomically. Accepts only the explicit project metadata keys in the function. A repeated project UUID raises a conflict rather than creating a second project. |
| `project_create_with_lead_as(id, lead, data, actor)` | Service-only import/API variant; another lead requires manager authority and event eligibility. Additional submission/track/answer workflows remain application work. |
| `project_invitation_create_as(...)` | Service only. Supply SHA-256 of an opaque token generated server-side from at least 32 cryptographically random bytes, plus private target and expiry. Share invites are explicitly scoped, single-consumption records. |
| `project_invitation_accept(project, token)` / `_as(..., actor)` | User/service variants. Supply the **raw token**, not its stored hash. SQL validates project, target, expiry, revocation, issuer authority and event membership; consumes and adds membership atomically. |
| `project_invitation_revoke(project, invitation)` / `_as(..., actor)` | User/service variants; idempotent revocation after project authorization. |
| `project_identity_backfill_batch`, `project_identity_backfill_progress`, `project_identity_pause_backfill` | Service-only worker controls. Backfill starts paused; each call processes at most one project in one transaction. |
| `project_identity_convert(...)` | Installed by M3, service only; requires a dedicated **SERIALIZABLE** transaction, not a default Data API RPC request. |

Invitation acceptance returns `joined`, `already_accepted`, or `no_longer_member`.
Retrying a consumed token does not re-enroll a removed member. New code must not
accept a bare project ID or forward old email-bearing JWTs. Contact exports and
invitation delivery must use separately authorized server paths; private schema
tables are not directly granted to browser or service roles.

For identity reads, request successive pages using the last returned `next_cursor`
until an empty page. Keep the same authorized project set and page size; configure
the page size at or below that environment's API row limit. Do not treat a short
page caused by an API cap as completion. Deduplicate by UUID and retry an affected
project if revisions differ across pages. Use a consistent database snapshot when
an export requires an exact point-in-time set. Hydrate profiles in batches and
serialize safe display names with a `Team member` fallback in the application.

## Backfill and conversion

Backfill is deliberately paused at installation. After worker rehearsal, the
database owner can set `rollout.backfill_paused` to false. The service pause RPC
can only pause; it cannot resume or weaken gates. Default batch calls use the
private durable cursor; cursor advancement and shadow updates commit together.
A final empty call marks completion and pauses. Reset `backfill_after` and
`backfill_finished_at` as owner for a full rescan. A failed transaction retains
the previous cursor. Caller-supplied `p_after` supports an explicitly selected
restart point; ordinary worker calls should omit it.

Matching uses only `lower(trim(email))`, a unique verified, non-deleted auth account,
and profile consistency if a profile exists. It never strips plus suffixes or
dots. Leads win over duplicate teammate appearances. Empty, invalid, missing,
unverified, ambiguous, and conflicting identities remain private reason codes.
The worker must stop/retry on database errors; logging includes IDs/counts/reason
codes, never emails or invitation tokens. Measure matching query plans against
each environment before choosing pacing; this migration adds no indexes to the
populated auth/profile tables. Add any needed online index in a separately
reviewed migration after measurement.

After M3, convert one project per dedicated serializable transaction. Supply the
reviewed `p_expected_revision`, exact `p_expected_user_ids` array, expected lead
UUID (or explicit null), and whether classified historical contacts may remain.
SQL refreshes mapping under the project lock, checks that review still matches,
and verifies no existing account loses legacy membership. Unverified accounts,
ambiguity, and profile conflicts always block conversion; only empty/invalid/
missing historical contacts may be explicitly accepted as unresolved. Retry
serialization failures with bounded backoff and renewed review when data changed.
The converter must not run as a batch inside one long transaction.

UUID projects do not acquire members merely because a later signup has a matching
email. Such users require a verified invitation or an authorized explicit member
addition. Legacy-source projects retain legacy authorization until converted.

## Availability and validation gates

The supported page URLs remain unchanged. Keep the compatible application able
to serve safe legacy-source data while backfill is paused or incomplete. Do not
deploy M2 before replacing wildcard/direct identity queries, including track and
feedback readers. Old browser tabs may need a refresh when their email-bearing
contract is retired; the compatible app must handle that without a blank page.

After M2, roll back only to the recorded compatible build. Never restore public
email grants as a rollback. After UUID conversion, retain UUID authority. After
M4, only a contract-safe build is a valid rollback. Rehearse these sequences in
staging before production.

Before any execution, add/run the approved real-database and browser suites on a
disposable database or dedicated staging clone, without resetting shared staging:

1. Migration order/gates and old-app compatibility after M1.
2. Actual anon/authenticated grants, RLS, views, GraphQL/RPCs, and API payloads;
   probe private-email canaries in both project routes, profiles and feedback.
3. Atomic create/transfer, duplicate add/remove, actor spoofing, lead invariants,
   invitation recipient/expiry/replay, removed-member denial, account deletion.
4. Separate-connection races: backfill versus edits; conversion versus edits and
   auth/profile changes; concurrent invite consumption; pause/restart.
5. Large memberships exceeding API limits, pagination completeness, generic
   names on profile failure, supported rollback, and measured lock/page latency.

Only offline SQL/PL/pgSQL parsing and static file review have been performed for
these drafts. Those checks do not validate deployed objects, RLS behavior,
transactional correctness, migration-runner behavior, or page availability.
