# Project identity migration proposal

Status: proposal only. All review recommendations 1A–15A were approved in the conversation. Application code and database migrations have not been changed or executed. Staging and production databases exist; neither environment has been inspected during this review.

**1. Intended result and approved scope**

Project ownership and membership use immutable account UUIDs. Project pages display the existing profile display_name, with “Team member” as the safe fallback. Public project responses, related identity responses, and direct database access must not expose system-stored account emails.

Keep the existing project URLs and core presentation aligned between the [authenticated route](/Users/jefferyzhou/Documents/MentorMates/app/projects/[id]/page.tsx) and [public route](/Users/jefferyzhou/Documents/MentorMates/app/projects/public/[id]/page.tsx). Preserve intended event/project visibility and legitimate editing rights. Authorization is enforced on the server and in database permissions, independently of which controls the frontend displays.

The user’s own account email, an email they type into an invitation form, and authorized organizer contact exports have different access requirements from public project identity. Preserve those operations through explicitly protected interfaces. Do not return contact fields in the common project response, even for organizers; fetch authorized contacts separately.

This proposal protects account/contact fields and email-based identity mappings. It does not silently redact user-authored project descriptions, feedback text, or biographies. Audit configured submission fields and integration metadata for copied account/contact data before calling the public response safe.

| Approved decision | Implementation consequence |
|---|---|
| 1A | Explicit public fields, database column restrictions, hardened profile API. |
| 2A | project_members(project_id, user_id, role), with keys and atomic writes. |
| 3A | Reuse display_name; no new unique username feature. |
| 4A | Additive, staged rollout with private reconciliation and validated invitation acceptance. |
| 5A | Shared serializer and team presentation; temporary server adapter for legacy storage. |
| 6A | Idempotent member add/remove operations; transactional creation and lead transfer. |
| 7A | Shared resilient loading with correct visitor access and separate identity errors. |
| 8A–11A | Public response tests, real database permissions, automated migration rehearsal, both-route browser tests. |
| 12A | Indexed UUID membership queries and batched profile enrichment. |
| 13A | Complete, bounded underlying fetches; preserve gallery behavior initially. |
| 14A | Restartable backfill with pacing and automatic pause thresholds. |
| 15A | Request-local reuse; no shared identity/permission response cache during transition. |

**2. Findings that determine the change**

| Location | Current behavior | Required change |
|---|---|---|
| [Project API](/Users/jefferyzhou/Documents/MentorMates/app/api/projects/route.ts:291) | Returns lead_email and email-valued teammates in project responses. Other branches spread full rows. | Build every project response with an explicit safe serializer, including nested data and mutation responses. |
| [Public page profile lookup](/Users/jefferyzhou/Documents/MentorMates/app/projects/public/[id]/page.tsx:132) and [private counterpart](/Users/jefferyzhou/Documents/MentorMates/app/projects/[id]/page.tsx:852) | Browser queries user_profiles by email; duplicated mapping and fallbacks. | Hydrate public identities on the server by UUID and use shared components. |
| [Public team display](/Users/jefferyzhou/Documents/MentorMates/app/projects/public/[id]/page.tsx:987) | Email can become the title, subtitle, key, and avatar text. | Key by user_id; display only sanitized public profile fields. |
| [Profile API](/Users/jefferyzhou/Documents/MentorMates/app/api/users/[userId]/profile/route.ts:306) | Spreads a service-role profile query into a public response. | Separate public profile fields from owner/contact fields. Remove the profile page’s email-as-bio fallback. |
| [Project grants and policies](/Users/jefferyzhou/Documents/MentorMates/supabase/migrations/20251029_project_rls.sql:91) | Readable rows include email columns; membership resolves account email. | Keep intended row visibility, restrict readable columns, replace membership checks. |
| [Older policies](/Users/jefferyzhou/Documents/MentorMates/supabase/migrations/20240419_add_project_submission_rls.sql:6) | Additional policy names reference legacy email columns. | Inventory actual policies in each environment; replace every applicable dependency, not only the newest helper. |
| [Legacy profile view migration](/Users/jefferyzhou/Documents/MentorMates/supabase/migrations/20240420_create_user_profiles_view.sql:2) | Defines an email-returning view and grants authenticated access. | Verify deployed existence and privileges; remove the alternate public identity-to-email lookup. Historical SQL is not proof of deployed state. |
| [Membership update helper](/Users/jefferyzhou/Documents/MentorMates/features/projects/client-actions/client-update.ts:19) | Replaces an email array and selects the entire updated row. | Use authenticated atomic UUID operations and explicit response fields. |
| [Team picker](/Users/jefferyzhou/Documents/MentorMates/app/projects/[id]/page.tsx:1973) | Parses emails out of labels and launches competing full-array updates. | Use structured user_id selections and explicit add/remove operations. |
| [Join endpoint](/Users/jefferyzhou/Documents/MentorMates/app/api/projects/join/route.ts:18) | Service-role append based on projectId alone. | Validate authorization or invitation at the actual mutation, then insert authenticated user_id atomically. |
| [Invitation verification](/Users/jefferyzhou/Documents/MentorMates/app/api/projects/verify-invite-token/route.ts:31) and [token payload](/Users/jefferyzhou/Documents/MentorMates/lib/utils/jwt.ts:22) | Return/store invitee email and sometimes inviter email in browser-visible data. | Use opaque invitation tokens with private server-side contact records; return minimal verification status. |
| [Feedback loader](/Users/jefferyzhou/Documents/MentorMates/features/projects/components/management/project-dashboard/hooks/useFeedbackData.ts:16) | Selects all feedback columns; feedback contains mentor_email. | Explicit public feedback fields and corresponding database restrictions. Reuse mentor_id for identified authors. |
| [Participant picker API](/Users/jefferyzhou/Documents/MentorMates/app/api/events/[eventId]/users/route.ts:128) | Returns participant emails to ordinary event participants. | Provide safe candidate identities; contact fields require organizer/admin authorization on a separate interface. |
| [Public project fetch](/Users/jefferyzhou/Documents/MentorMates/app/projects/public/[id]/page.tsx:110) | Omits public=true, although the API requires authentication on that branch. | Make anonymous and authenticated route behavior explicit without accidentally making private event projects world-readable. |
| [Profile creation trigger](/Users/jefferyzhou/Documents/MentorMates/supabase/migrations/20260409_user_profile_auth_trigger.sql:29) | Uses the email local part as a fallback name. | Stop deriving new public names from email; use a neutral fallback. Existing names need deliberate handling, not indiscriminate rewriting. |

The [invitation security document](/Users/jefferyzhou/Documents/MentorMates/PROJECT_INVITATION_SECURITY.md) describes an older flow and differs from current code. Update it with the implementation; validate actual token/hash paths rather than relying on that document.

**3. Target schema and invariants**

Use one membership table for both lead and teammate roles. Do not store a second independent lead_user_id on projects. A lead ID needed by a client can be derived from the role-bearing membership.

The existing teams/team_members tables remain the event team-formation model. They are optional, allow teams before projects, and enforce one team per user per event. Project membership must not inherit those constraints.

The following is an illustrative target definition, not an executable migration or a complete permissions script:

~~~sql
CREATE TABLE public.project_members (
    project_id uuid NOT NULL
        REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id uuid NOT NULL
        REFERENCES auth.users(id) ON DELETE RESTRICT,
    role text NOT NULL CHECK (role IN ('lead', 'member')),
    joined_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, user_id)
);

CREATE INDEX project_members_user_project_idx
    ON public.project_members (user_id, project_id);

CREATE UNIQUE INDEX project_members_one_lead_idx
    ON public.project_members (project_id)
    WHERE role = 'lead';

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_members FROM PUBLIC, anon, authenticated;
~~~

The auth.users reference keeps identity independent of editable/deletable profile metadata. Batch profile enrichment joins by user_profiles.uid in server code; it must not assume a direct PostgREST relationship to user_profiles exists. Validate actual account/profile constraints before implementing the FK.

Proposed account-deletion default: active memberships prevent silent account deletion. The account-deletion workflow must explicitly transfer a lead role when needed, remove memberships, then delete the account. A missing/deleted profile alone produces a generic display name without changing membership.

The unique index guarantees at most one lead. Transactional creation and lead transfer enforce exactly one lead for an actively owned project. Historical projects whose lead never registered can remain explicitly unclaimed, with private reconciliation records and existing organizer administration; do not fabricate a lead account or hide the project. Do not remove a current legitimate member’s access to make a backfill pass.

Add a non-exposed schema, proposed name project_identity_private, with:

| Private table | Purpose and key fields |
|---|---|
| project_identity_state | project_id primary key; source = legacy or members; revision; verified_at; migrated_at; optional unclaimed-lead status. Row is not editable by browser roles. |
| project_identity_reconciliation | Project, legacy role, original/normalized email, optional resolved user_id, reason, status, and restricted audit timestamps. Track invalid, missing, conflicting, and pending identities. Never return raw records publicly. |
| project_invitations | Project, hashed opaque token, inviter_user_id, optional recipient_user_id, private recipient_email, expiration, revocation and acceptance information. Registered membership and pending invitations are distinct. |

Deny PUBLIC/anon/authenticated access to the private schema, its tables, and default privileges. Grant only the narrowly required server/migration access. A schema being omitted from the Data API is not a substitute for database grants.

Install migration-state initialization for existing and newly inserted projects, including writes made by an older application during the overlap. Initialize existing state in bounded batches before enabling the new API; the existing application does not depend on those rows. Writes occurring during initialization must create/lock their state row transactionally. Missing state after initialization is an operational error, not permission to choose a membership source heuristically.

**4. Public contracts and server boundaries**

A member in the public response has a real UUID:

~~~ts
type PublicProjectMember = {
  user_id: string;
  role: "lead" | "member";
  display_name: string;
  avatar_url: string | null;
  affiliation: string | null;
};

type ProjectIdentityPresentation = {
  members: PublicProjectMember[];
  unresolved_member_count: number;
  identity_status: "ready" | "partial" | "unavailable";
};

type ProjectViewerCapabilities = {
  can_edit: boolean;
  can_manage_members: boolean;
  can_delete: boolean;
};
~~~

These are proposed contracts, not additions already made to the repository.

Public project content and viewer-specific capabilities have separate types. Capabilities reflect verified server authorization and are never trusted as client-supplied input. An unavailable profile name does not change capability calculations.

An unresolved historical record is not a PublicProjectMember with a fake or email-derived ID. Render a generic aggregate for unresolved records; after reconciliation, the real member can appear. When even identity counts are unavailable, show a neutral team-unavailable state instead of inventing a count.

Name handling:

- Trim display_name; use “Team member” when empty or email-valued.
- Never fall back to account email or derive a new fallback from its local part.
- Never key selections, React rows, member links, toasts, or avatar services by email.
- Duplicate names are valid. UUIDs distinguish people; affiliation/avatar can help users select them.
- Use a strict public projection rather than spreading raw database rows or casting them to Project.
- Audit old lead_name, mentor_name, profile bio fallbacks, and copied metadata. Do not grant raw identity columns public access merely because their column name lacks “email.”
- Keep explicit user-authored content separate from system-derived identity data.

Read path:

1. Validate the project identifier and determine the caller from a verified session, or anonymous context.
2. Apply existing intended event visibility, submission/draft rules, and project RLS using the caller’s client.
3. Only for the allowed project IDs, resolve membership through the private source marker.
4. Batch public profile fields for the resulting account IDs. If a service client is required because profile RLS is private, constrain it to these already authorized IDs and an explicit column list.
5. Serialize the public contract. Resolve capabilities through the authoritative access path.
6. Distinguish missing/denied projects from transient failures. A metadata/profile failure may degrade presentation, but a failed visibility check must never return protected project data.

Use a versioned project response endpoint during mixed application deployment, proposed /api/projects/v2, so new frontend code does not consume an old incompatible shape. Keep shared server implementation beneath any temporary endpoint wrappers. Project page URLs do not change.

The compatibility adapter accepts both database representations on the server, but returns only the new public contract. It never forwards legacy email arrays to the updated browser.

**5. Atomic membership operations and invitation handling**

Provide narrow transactional operations:

- Create project with its initial lead.
- Add a registered member by user_id.
- Remove a member by user_id.
- Transfer the lead role.
- Accept/revoke an invitation.
- Convert one project’s membership source.

All membership operations acquire the same project-row lock, then the private state row, in the same order. Re-check permissions inside the transaction after locking. Backfill follows this order too.

While source = legacy, the transactional writer updates the legacy representation and a temporary one-way synchronization path maintains the shadow member rows. Synchronization covers existing insert/update writers during the overlap. Preserve unresolved legacy entries in private reconciliation rather than treating failed matches as deletions.

While source = members, the writer changes project_members only. Old email membership changes are rejected. Do not keep independent, bidirectional synchronization or allow arbitrary direct array replacement to remain another source of truth.

Install one temporary legacy-to-shadow mechanism before backfill; do not also perform competing application-level shadow writes. Validate foreign keys, uniqueness and lead invariants inside the transaction. Real database errors fail that mutation atomically; do not silently swallow errors to keep both representations apparently synchronized.

Caller identity comes from the authenticated context, not a JSON actor field. For normal user RPCs, derive auth.uid(). Verified agent requests/imports that need service access use a service-only wrapper with server-validated actor and event scope. Never grant a service wrapper to ordinary users.

Narrow security-definer functions must have a fixed safe search_path, schema-qualified references, restricted ownership and EXECUTE grants. Avoid recursive RLS between projects and project_members. Keep read permissions separate from permission to add oneself or change a lead.

Invitation behavior:

- A new invite URL carries an unpredictable opaque token; the database stores its hash and private target contact data.
- Verification returns status and safe project information, never recipient_email or an email-bearing JWT payload.
- Acceptance validates token, project, expiry, revocation, intended recipient and event eligibility on the server at mutation time.
- Set the accepted member to the signed-in account UUID, never a user ID supplied by the invitee.
- Acceptance/consumption and membership insert are one transaction. Retrying acceptance for the same authorized user is idempotent; reuse must not add other users.
- Preserve intentional general share-invite semantics only through explicitly scoped server-validated invite records. A bare projectId is not an invitation.
- Newly registered users claim pending invitations through verified acceptance; merely creating a profile with a matching email must not silently grant historical membership.
- Handle still-valid legacy invitations through a bounded, server-side compatibility path only where their authenticity and recipient can be verified. Unsafe legacy hash schemes or unverifiable links require reissue. Stop issuing email-bearing tokens in the compatible release.

Update database policy dependencies as well as the API helper: projects, project_tracks, project_artifacts, project_submission_answers, project_field_entries, applicable feedback paths, and any deployed views/functions using legacy columns. Inspect pg_policies, function definitions, grants and dependencies in staging and production. Remove obsolete permissive policies that would otherwise remain an alternate authorization route.

Install source-aware access helpers before permitting any source = members transition. All existing production projects initially remain source = legacy. M3 must gate or replace every remaining email-based permissive policy before the first production source switch; otherwise an obsolete policy could still authorize a removed member. After cutover is enabled, new project creation initializes UUID membership and its source marker in the same transaction. Test only supported app/schema/source combinations, including the source-aware policy installation required by converted fixtures.

**6. Code change map**

| Area | Existing files to update | Change |
|---|---|---|
| Shared types and data access | [types](/Users/jefferyzhou/Documents/MentorMates/lib/types/index.ts), [generated DB types](/Users/jefferyzhou/Documents/MentorMates/lib/database.types.ts), [query](/Users/jefferyzhou/Documents/MentorMates/lib/projects/query.ts), [access](/Users/jefferyzhou/Documents/MentorMates/lib/projects/access.ts), [participant projects](/Users/jefferyzhou/Documents/MentorMates/lib/projects/participant-projects.ts) | Distinct public/contact types, explicit source adapter, UUID membership queries, safe profile hydration. Regenerate DB types at each compatible schema phase. |
| Detail routes and hooks | [private page](/Users/jefferyzhou/Documents/MentorMates/app/projects/[id]/page.tsx), [public page](/Users/jefferyzhou/Documents/MentorMates/app/projects/public/[id]/page.tsx), [hook](/Users/jefferyzhou/Documents/MentorMates/features/projects/hooks/use-project.ts), [direct helper](/Users/jefferyzhou/Documents/MentorMates/features/projects/utils/projects.ts) | Shared identity rendering/loading; remove email queries; correct guest access; explicit error, retry and cancellation handling. Preserve route presentation parity. |
| Project API and writes | [project API](/Users/jefferyzhou/Documents/MentorMates/app/api/projects/route.ts), [user projects](/Users/jefferyzhou/Documents/MentorMates/app/api/projects/user/route.ts), [submit](/Users/jefferyzhou/Documents/MentorMates/app/api/projects/submit/route.ts), [project PATCH/DELETE](/Users/jefferyzhou/Documents/MentorMates/app/api/projects/[projectId]/route.ts), [submission service](/Users/jefferyzhou/Documents/MentorMates/lib/projects/submission-service.ts), [client updates](/Users/jefferyzhou/Documents/MentorMates/features/projects/client-actions/client-update.ts) | UUID input and access, atomic identity mutations, explicit safe read/return fields. Verify delete rules and organizer overrides. Route guards also apply to update-via-submit paths. |
| Forms and selection | [new form](/Users/jefferyzhou/Documents/MentorMates/features/projects/components/forms/NewProjectSubmissionFormSinglePage.tsx), [draft form](/Users/jefferyzhou/Documents/MentorMates/features/projects/components/forms/DraftProjectSubmissionFormSinglePage.tsx), [edit page](/Users/jefferyzhou/Documents/MentorMates/app/projects/[id]/edit/page.tsx), [submit page](/Users/jefferyzhou/Documents/MentorMates/app/projects/submit/page.tsx), [existing UUID picker](/Users/jefferyzhou/Documents/MentorMates/features/teams/components/TeammatePicker.tsx) | Structured candidate identities and idempotent add/remove. Reuse the picker’s identity pattern without inheriting event team constraints. |
| Invitations | [invite](/Users/jefferyzhou/Documents/MentorMates/app/api/projects/invite-teammate/route.ts), [generate](/Users/jefferyzhou/Documents/MentorMates/app/api/projects/generate-invite-token/route.ts), [verify](/Users/jefferyzhou/Documents/MentorMates/app/api/projects/verify-invite-token/route.ts), [join mutation](/Users/jefferyzhou/Documents/MentorMates/app/api/projects/join/route.ts), [token utility](/Users/jefferyzhou/Documents/MentorMates/lib/utils/jwt.ts), [legacy utility](/Users/jefferyzhou/Documents/MentorMates/lib/utils/invite-links.ts), [join page](/Users/jefferyzhou/Documents/MentorMates/app/join-project/page.tsx), [token join page](/Users/jefferyzhou/Documents/MentorMates/app/projects/join/[id]/[token]/page.tsx) | Private invitation records, opaque tokens, mutation-time verification, UUID membership and safe responses. |
| Galleries, profiles and certificates | [project board](/Users/jefferyzhou/Documents/MentorMates/features/projects/components/displays/ProjectBoard/ProjectBoard.tsx), [gallery](/Users/jefferyzhou/Documents/MentorMates/features/projects/components/displays/PublicProjectsGallery/PublicProjectsGallery.tsx), [project list](/Users/jefferyzhou/Documents/MentorMates/app/projects/page.tsx), [profile API](/Users/jefferyzhou/Documents/MentorMates/app/api/users/[userId]/profile/route.ts), [profile page](/Users/jefferyzhou/Documents/MentorMates/app/profile/[userId]/page.tsx), [certificate](/Users/jefferyzhou/Documents/MentorMates/app/certificate/[id]/page.tsx) | UUID owner checks, safe team previews, membership-derived profile projects and certificate names. |
| Feedback and contributors | [feedback loader](/Users/jefferyzhou/Documents/MentorMates/features/projects/components/management/project-dashboard/hooks/useFeedbackData.ts), [display](/Users/jefferyzhou/Documents/MentorMates/features/projects/components/feedback/FeedbackDisplay.tsx), [form](/Users/jefferyzhou/Documents/MentorMates/features/projects/components/feedback/FeedbackForm.tsx), [feedback API](/Users/jefferyzhou/Documents/MentorMates/app/api/feedback/route.ts), [entry API](/Users/jefferyzhou/Documents/MentorMates/app/api/projects/[projectId]/field-entries/route.ts) | Explicit safe author fields, retain mentor_id/submitter_user_id, remove public contact returns and project membership email lookups. Update existing contact columns/grants where present. |
| Event rosters/team formation | [event users API](/Users/jefferyzhou/Documents/MentorMates/app/api/events/[eventId]/users/route.ts), [teams API](/Users/jefferyzhou/Documents/MentorMates/app/api/events/[eventId]/teams/route.ts), [team panel](/Users/jefferyzhou/Documents/MentorMates/features/teams/components/TeamFormationPanel.tsx) | Safe picker responses, protected contact operations and UUID-based project selection. |
| Imports, exports and integrations | [import](/Users/jefferyzhou/Documents/MentorMates/features/user/dashboards/dashboard/organizer/import/ProjectImportButton.tsx), [submission exports](/Users/jefferyzhou/Documents/MentorMates/features/user/dashboards/dashboard/organizer/submissions/export.ts), [score exports](/Users/jefferyzhou/Documents/MentorMates/features/user/dashboards/dashboard/organizer/scores/export.ts), [participant exports](/Users/jefferyzhou/Documents/MentorMates/features/user/dashboards/dashboard/organizer/participants/export.ts), [Contextus prefill](/Users/jefferyzhou/Documents/MentorMates/app/api/contextus/prefill/route.ts), [agent project API](/Users/jefferyzhou/Documents/MentorMates/app/api/agent/me/events/[eventId]/projects/route.ts) | Keep email resolution at protected server boundaries; never use public responses to supply export or integration contact data. Preserve unresolved imported contacts privately. |

Also update identity comparisons in participant/judge/admin dashboards, organizer submission/score/participant screens, event overview, my-project sections, project management, and meeting project selection. The preflight search must include lead_email, lead_name fallbacks, teammates, project_email, team_lead_email, mentor_email, user_profiles email selections, wildcard selections and email-bearing JWT payloads.

Suggested new shared modules, under the existing project feature/lib directories: public identity projection, public project serialization, source adapter, transactional membership service, shared team overview/list, and shared project loader. Keep these narrowly scoped; do not rewrite unrelated project sections.

**7. Migration and release manifest**

Names below describe future timestamped migrations. Do not create all of them as pending migration files in the first release. The later phases must not be accidentally applied by “apply all pending migrations.”

| Phase | Deliverable | Gate before execution |
|---|---|---|
| M1: expand | add_project_member_identity_storage: membership/private tables, indexes, explicit grants/RLS, state initialization, temporary synchronization, narrow operations. No removal or read restriction on existing project columns yet. | Verified schema baseline, disposable DB tests, staging rehearsal of old app against expanded schema. |
| A1: server compatibility | New safe response endpoint, source adapter, protected profile/feedback/contact boundaries, new membership/invitation operations. Existing legacy endpoints remain only during the deployment preparation interval. | New server endpoint works against legacy storage and an empty shadow membership table. |
| A2: compatible frontend | Both routes and every identity consumer use safe contracts and server mutations. Record the immutable build as the post-privacy rollback baseline. | Both routes, gallery, forms, invitations and authorized exports pass with legacy and converted fixtures. |
| M2 + A3: privacy cutover | restrict_project_identity_exposure and matching endpoint cutover: revoke broad grants, grant explicit safe columns, remove contact-bearing legacy responses and alternate view/function exposure. Browser direct membership writes are retired. | Compatible code is active; legacy server instances/routes cannot still serve contact data; direct database and API tests pass in staging. No backfill completion dependency. |
| B1: online backfill | Resumable migration runner with private checkpoints, pacing and reconciliation. This is a controlled job, not a massive migration transaction. | Synchronization active; baseline metrics captured; auto-pause thresholds validated. |
| M3/C1: UUID authority | Final authorization helpers/policies and atomic per-project source transition after validation. Restrict legacy identity writes for converted projects. | Mapping/access parity checked, active owners preserved, unresolved records classified, concurrency rehearsal passed. |
| A4: remove adapter dependence | A later application release stops selecting legacy identity columns and no longer needs legacy-source support for active converted records. | No remaining legacy-source projects requiring fallback; historical contacts retained privately as needed. |
| M4: contract | remove_legacy_project_email_membership: remove projects.lead_email and projects.teammates plus dependent legacy helpers/policies/indexes; retire legacy lead_name only after its remaining consumers are migrated. Remove temporary synchronization/state only when nothing references it. | Dependency inventory empty, compatible rollback builds are contract-safe, migration verified on a staging clone/disposable baseline. |

At M2, revoke the effective table-wide SELECT privileges before granting a safe column list. Check privileges inherited via PUBLIC and views/functions as well. Do not merely issue REVOKE SELECT(email) while leaving table-wide SELECT active.

Restrict protected fields on publicly readable feedback too; fix wildcard feedback readers before that restriction. Keep user_profiles private under its own intended RLS. Do not solve name lookup by granting anonymous access to the full profiles table.

Explicitly list safe project columns from the verified deployed schema. Do not generate a broad “all columns except two” grant; future contact columns must not become public by default. Metadata reads that already select safe columns, including the public project layout, should remain functional.

Review INSERT/UPDATE grants as well as SELECT: a browser must not directly change membership source, replace a legacy membership array, insert itself into project_members, or change lead role. Keep allowed non-identity project edits working through the approved paths.

**8. Backfill and source transition algorithm**

For each environment:

1. Inventory projects and original membership records. Normalize only with lower(trim(email)); do not strip dots or plus suffixes, or guess equivalent accounts.
2. Match to a unique verified auth account. Confirm profile/account identity consistency where a profile exists. An absent profile can still be a valid auth UUID with generic presentation; a conflicting profile UID requires reconciliation.
3. Deduplicate project/user pairs, treating lead as the role when the same account appears as lead and teammate. Flag multiple plausible leads or ambiguous matches instead of assigning arbitrarily.
4. Acquire the project lock, then state lock. Re-read the current legacy data inside the transaction. Never apply an earlier scan’s stale array.
5. While source = legacy, reconcile the complete shadow set with the current legacy source, including removals. Upsert-only synchronization is insufficient because it would preserve departed teammates.
6. Record unmatched/invalid/conflicting records privately. Commit a bounded unit of work, advance its checkpoint and release locks.
7. Before changing source, verify shadow coverage and intended permissions for existing accounts. Keep an unclaimed historical lead explicit when no account exists. Leave a project in legacy state if a real authorization ambiguity remains.
8. Atomically mark source = members after validation. Subsequent writes and policies use UUID membership and reject legacy identity updates.
9. If source = members, never fall back because the table is empty, a query failed, a profile is absent, or a member was removed.
10. Resume interrupted work from durable state. Skip already converted projects rather than reconstructing them from old emails.

Use the same transactional boundary for new project creation and its initial member. Backfill must account for projects created during execution. Keep a controlled reconciliation/claim path for historical contacts after public email access has been removed.

**9. Availability, stale clients and rollback**

Availability target: no planned project-page downtime for supported application builds. The compatibility release must work against legacy, partial, and converted storage before privacy restrictions are applied.

The privacy boundary is complete only after M2/A3 endpoint and direct-access checks pass. The additive preparation releases alone do not fix the original exposure. Keep that interval short and independent of historical backfill duration.

Older open tabs:

- Existing browser JavaScript cannot be retroactively changed. A tab running the pre-compatibility build may need a refresh when old access is retired.
- The compatible build handles version mismatch and loading errors, preserves unsaved form state before asking for refresh, and does not show a blank page.
- Retire old endpoint contracts with an explicit version-expired response or safe adapter; never keep returning real emails solely for stale clients.
- Protected raw Supabase queries from old tabs can fail after column restrictions. This is expected retirement of the old client, not a reason to restore the grants.
- Already delivered emails cannot be recalled from users’ browsers. Purge controlled legacy caches and retire old deployment routes; do not claim historical exposure has been undone.

Rollback boundaries:

| Point | Allowed recovery |
|---|---|
| Before privacy cutover | Roll back application changes while retaining additive schema. Fix compatibility before proceeding. Existing exposure is still an outstanding issue. |
| After privacy cutover | Roll back only to the recorded compatible build that uses safe contracts and respects database restrictions. Never restore table-wide email reads or old email-bearing endpoints. |
| During backfill | Pause the runner and resume from checkpoints. Continue serving legacy-source projects through the safe server adapter. |
| After a project uses UUID authority | Keep its source marker and membership data. Fix/roll back app code without restoring stale legacy membership authority. |
| After removing legacy columns | Use only builds verified without those columns. Restoring old code or toggling a flag is no longer a valid rollback. |

On profile enrichment errors, return generic names/unavailable identity state for an otherwise authorized project. On a project access/read error, show a safe retry/error state; never fall through to a service-role read that returns a denied project. Disable membership mutations if authoritative permission data cannot be obtained.

Ensure public route and authenticated route share non-sensitive presentation, while intentionally access-controlled editing/team controls remain separate and documented.

**10. Staging-to-production runbook**

Staging is the integration and release rehearsal environment. Disposable/local databases or a dedicated staging clone are used for destructive migration/concurrency tests; do not reset a shared staging database as an incidental test step.

Record before any database action:

| Item | Staging | Production |
|---|---|---|
| Verified project reference/host and matching application build | Pending inspection | Pending inspection |
| Actual PostgreSQL version and migration history | Pending inspection | Pending inspection |
| Current grants, RLS, exposed views/RPCs and default privileges | Pending inspection | Pending inspection |
| Project/member counts and unresolved identity categories | Pending inspection | Pending inspection |
| Baseline page latency, error rate, lock waits and resource use | Pending measurement | Pending measurement |
| Tested compatible rollback build | Set after A2 rehearsal | Same reviewed build/configuration mapping |
| Batch size, pacing and pause/resume thresholds | Determine by rehearsal | Adjust for measured production capacity |

Do not copy staging UUID-to-email mappings to production. The same code/migrations run in each environment, but each backfill resolves that environment’s own accounts and records.

Staging sequence:

1. Capture the schema/grant baseline and prepare synthetic fixtures, including missing profiles, unknown contacts, duplicate names, private events and concurrent edits.
2. Apply M1 alone. Verify the current app still works with the expanded schema.
3. Deploy A1, then A2. Verify safe response shape and both routes before restrictive grants.
4. Apply M2/A3. Probe raw table/view/RPC access and every retired endpoint. Confirm ordinary visitors cannot recover account emails from returned UUIDs.
5. Run B1 while exercising page reads, submissions and membership edits. Test interruption, restart, auto-pause, and conflicting identities.
6. Exercise M3/C1 for selected fixtures, then the complete rehearsed dataset. Validate access parity and no resurrection of removed members.
7. Rehearse application rollback with email restrictions kept in place.
8. Rehearse A4/M4 separately. Record evidence and approved release artifacts.

Production sequence:

1. Verify production-specific schema/configuration differences and explicitly identify the target before running any command.
2. Promote the same reviewed migrations and application changes in the same order. Do not use a production release job that applies later-phase pending migrations early.
3. Run additive compatibility checks before exposing the new client.
4. At privacy cutover, ensure obsolete server instances and publicly reachable old deployments cannot still serve contact-bearing endpoints. Use a coordinated route switch/build deployment rather than leaving a mixture of old email-serving handlers active.
5. Run privacy/read/write smoke checks, including anonymous public project access, unrelated signed-in access and a legitimate member edit.
6. Start backfill with conservative pacing. Automatically pause on validated thresholds; do not automatically broaden permissions or flip source markers to recover.
7. Promote UUID authority only after per-project verification. Unknown historical contacts remain private; unresolved real ownership conflicts block conversion of that project, not public email protection.
8. Keep cleanup as a separately gated later release.

Thresholds and observation duration are deliberately not guessed here. Measure them, record them in the runbook, and distinguish staging success from proof of identical production capacity.

**11. Verification and release gates**

Run tests with synthetic private email canaries and real authenticated/anonymous roles. Service-role success is not evidence that a browser role is safe.

| Suite | Required assertions |
|---|---|
| Public contract/unit/API | Strict fields; private emails absent from project, profile, feedback, roster, invitation and mutation responses; no raw-row spread; duplicate/missing/email-valued names; UUID keys; equivalent legacy/member presentation. |
| Database/RLS/Data API | Safe columns remain readable; protected columns/views/functions denied to ordinary roles; legacy permissive policies retired; correct public/private event access; no self-enrollment or actor spoofing; direct grants match the intended boundary. |
| Membership/transactions | Idempotent add/remove; duplicate prevention; lead transfer and project creation atomic; invitation expiry/recipient/project/replay checks; email change does not change UUID membership; account/profile deletion handled deliberately. |
| Backfill/concurrency | Normalization, missing/conflicting accounts, restart, live creation, concurrent add/remove, source transition, no stale resurrection, private reconciliation, correct behavior after retries. Use separate connections with controlled ordering. |
| Both-route browser tests | Anonymous eligible access; intended private/event access; shared layout/section/member parity; title/content remain on profile failure; retry on transient project failure; editing still works after restrictions; no account email canaries in DOM/network. |
| Rollout/rollback | Current app plus additive schema; compatible app before/after restrictions; partial/full backfill; compatible rollback after privacy cutover; contract-safe app after removal. Retired pre-compatibility clients are checked for safe failure/refresh behavior. |
| Regression | Draft autosave, submission/import, project tracks/artifacts/answers/entries, invitations, dashboards, certificates, agent APIs and authorized contact exports remain functional. |
| Performance | Query counts by batch, complete results beyond configured row limits, event response size/memory, membership query plans, batch duration, latency/error/lock-wait behavior while backfill runs. |

Add a dedicated real-database CI suite and staging browser fixtures. Keep existing unit tests, updating email fixtures to UUID identity where appropriate. Do not replace real permission/transaction tests with mocked helpers.

Gate G1, before M2: compatible client/server proven against legacy and UUID fixtures; all restricted-column readers/writers replaced; safe profile/feedback/roster/invitation paths ready.

Gate G2, after M2: direct database and endpoint probes cannot retrieve protected emails; legitimate page reads and edits still pass. This establishes closure of the known exposure paths.

Gate G3, before UUID authority: per-project identity reconciliation and permission checks pass; concurrency and rollback rehearsal pass.

Gate G4, before M4: no remaining live code/policy/function dependencies on removed columns; private historical records retained where needed; rollback build is contract-safe.

**12. Performance implementation**

- Batch member lookup for authorized project IDs, then public profile lookup for distinct user IDs. Preserve batching already used by project enrichment.
- Use the membership key for project/user existence checks and the reverse index for user-to-project queries. Avoid redundant standalone indexes on the leading columns without query-plan evidence.
- Bound both input ID batches and returned result pages. A bounded list of project IDs can still produce more than the configured row limit.
- Use stable ordering while traversing results. Do not silently truncate memberships, artifacts, answers or candidate lists at a default API limit.
- Initially preserve the gallery contract. Reduce unnecessary identity payload fields and measure whole-event memory/response size in staging; end-to-end gallery pagination is a separate scope decision if measurements require it.
- Stream/checkpoint the backfill rather than loading all contacts/projects into memory. Use short per-project transactions, bounded retries and adjustable pacing.
- Create indexes on the new empty table before backfill. Any additional indexes on populated tables need a verified online procedure and migration-runner compatibility.
- Reuse data within a request. Do not add shared caching of identity/permission responses during rollout. Explicitly set appropriate no-store behavior on affected endpoints; preserve unrelated asset caching.
- Pause the migration on a failed identity invariant, unexpectedly large error rate, or measured resource/lock threshold. Log counts, IDs and reason codes without raw emails or invitation tokens.

**13. Completion criteria**

The implementation is complete when:

- Project UI and ordinary project-related APIs use UUID identities and safe names.
- Account emails cannot be recovered through known public project, profile, feedback, roster, invitation, direct table/view or RPC paths.
- Intended access persists through the transition; removed members do not regain access through legacy data.
- Staging has rehearsed the exact deployment order and safe rollback.
- Production has passed privacy, availability and membership gates.
- Legacy email membership dependencies have been retired, with unresolved historical contact data handled privately.
- Both project detail routes remain aligned and the approved tests pass.

This document completes the requested proposal. It does not claim the vulnerability is fixed, that staging/production have been audited, or that the migrations/tests have run.

**14. Reference material**

- [Supabase column privileges](https://supabase.com/docs/guides/database/postgres/column-level-security): table-wide privileges must be removed before column grants enforce a narrower read boundary.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): policies, grants, and view/function behavior must all be considered.
- [Supabase database tests](https://supabase.com/docs/guides/local-development/testing/overview): pgTAP and database testing workflow.
- [Supabase result pagination](https://supabase.com/docs/reference/javascript/using-modifiers-range): explicit result paging.
- [PostgreSQL 15 index creation](https://www.postgresql.org/docs/15/sql-createindex.html): concurrent index builds and their transaction restrictions.
- [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/17/sql-altertable.html): lock/constraint-validation considerations; verify exact operations against each environment’s actual major version.
