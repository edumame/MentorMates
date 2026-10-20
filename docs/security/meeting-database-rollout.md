# Meeting database boundary rollout

The repository contains two staged migrations and a reduced-fixture PostgreSQL integration test. They have been tested in an isolated PostgreSQL 16.15 container. **No deployed Supabase migration or production schema verification is claimed.**

## Required deployment sequence

Do not run an undifferentiated `supabase db push` that applies both migrations before the application consumer is deployed. File order alone cannot provide the required application deployment between stages. Record each staged application through the deployment process and keep the target Supabase migration history synchronized, so a later routine migration run does not mistakenly replay an already applied stage. Do not mark a stage applied before it has executed successfully.

1. Inspect the target schema, existing meeting policies, table and column grants, role memberships, triggers, and callable SECURITY DEFINER functions through the authorized database deployment process. Inventory mismatched meeting/project/event associations. Do not automatically rewrite historical records.
2. Apply only [202610200002_meeting_timeline_projection.sql](../../supabase/migrations/202610200002_meeting_timeline_projection.sql). This additive stage provides the authorized fixed-column `project_meeting_timeline` projection, the full-row access helper, and `meeting_associations_allowed`, which create/update handlers must call before Stream work. Verify both the timeline and association RPCs as an authorized user before proceeding.
3. Deploy the application consumer that reads this RPC, uses its `can_view_details` result for detail links, and writes only permitted meeting metadata. Verify owner editing, project timeline, organizer score views, and server processing. The public project route currently has no timeline; this change does not add one.
4. Only after the consumer is live, apply [202610200003_restrict_meetings.sql](../../supabase/migrations/202610200003_restrict_meetings.sql). This removes broad meeting policies and client table/column grants, grants limited writable metadata, enforces association consistency, and restricts the historical auto-conversation definer RPC. Unexpected meeting policy names cause the transaction to fail before changes are made; investigate rather than remove that check.
5. Verify anonymous denial, teammate metadata-only timeline, owner and authorized event management access, safe metadata creation/editing, service processing updates, and automatic role-trigger conversations on the deployed environment. Review effective privileges, including inherited roles, rather than checking policy text alone.

The restrictive protection is not active until the restrictive migration in step 4 is actually installed. If a target cannot be inspected or these stages cannot be separated, keep deployment pending. No application fallback should restore broad full-row reads. Roll back application changes only to a version compatible with the additive projection; do not restore public SELECT as a rollback shortcut.

## Real database tests

From the repository root, with Docker and Python 3 installed:

```sh
python3 scripts/test_meeting_database.py
```

The wrapper accepts no existing-container, database URL, or repository arguments. It pulls PostgreSQL 16.15 with a separate cold-pull timeout, creates a random container with `--network none`, tmpfs data, and no published ports, waits for the final TCP server, then removes the container in `finally`. It never connects to a deployed database.

The internal test engine and synthetic schema/data live in [scripts/tests/meeting_database](../../scripts/tests/meeting_database). Tests read the two actual checked-in migrations above, plus the actual historical agents, meetings, project-policy and automatic-conversation migrations. There are no duplicate copies of the migrations in the fixtures. The synthetic fixture supplies only their required dependencies and test identities; it is not a complete schema bootstrap or production snapshot.

The `meeting-database` job in [validation.yml](../../.github/workflows/validation.yml) runs the same wrapper separately from unit/build and scraper quota checks. Assertions cover:

- Anonymous, missing identity, owner, teammate, event owner/organizer/admin, platform admin, wrong-event and outsider visibility; public/private/standalone timelines and fixed columns.
- Spoofed owners and server-owned fields rejected on client INSERT/UPDATE with SQLSTATE 42501; table and stale-column grants removed.
- Agent and project association validity, including global, primary-event, junction, disabled/missing, null-enabled and caller-owned agent cases.
- Legacy name-only edits, safe reassociation, owner/nonowner update/delete filtering, and service-owned processing writes.
- Exactly one winner across 16 concurrent conditional processing claims.
- Repeat-safe restrictive migration and unexpected-policy preflight preserving existing state.
- Direct client calls to the historical auto-conversation definer RPC denied, while the actual role trigger and service retry retain correct behavior without duplicate conversations.

## Limits and compatibility

The full-row policy permits the meeting owner, or authorized management of its associated event. Platform administrators do not thereby gain access to unrelated standalone meetings. The timeline exposes selected metadata only; it excludes transcripts, recording URLs and summaries. Meetings with contradictory project/event associations are excluded from that projection.

Association checks intentionally require write provenance rather than merely public project readability. Existing caller-owned event agents remain usable without an explicit event; explicit contradictory event selection is rejected unless an agent-event association permits it. `enabled = false` rejects a new association; legacy name-only edits do not revalidate a disabled agent.

Trusted server/database roles still write processing fields and retain the historical role-trigger behavior. Tests do not prove that every definer function, inherited role, default, or trigger in a deployed environment matches this reduced fixture; the predeployment inspection remains necessary.

Direct client inserts using permitted columns can still bypass application-only session-cap checks. This change does not claim an end-to-end billing quota or complete Stream/chat privacy protection. Those require separate controls.
