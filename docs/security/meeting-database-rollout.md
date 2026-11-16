# Meeting database boundary rollout

[202611110401_meeting_timeline_and_client_limits.sql](../../supabase/migrations/202611110401_meeting_timeline_and_client_limits.sql) builds on two migrations already in `main`:

- [202611030002_restrict_meeting_agent_reads.sql](../../supabase/migrations/202611030002_restrict_meeting_agent_reads.sql) dropped public meeting reads. Its replacement policy still let project teammates and event judges read full rows, including transcript URLs and summaries.
- [202611060401_protect_meeting_provider_urls.sql](../../supabase/migrations/202611060401_protect_meeting_provider_urls.sql) stops clients forging `transcript_url`, `recording_url` and `provisioning_failed`. This migration keeps that trigger.

## What changes

- **Full rows.** The policy `Owners and event staff can read meetings` replaces `Owners, teammates and event staff can read meetings`. Only the meeting owner and the people who manage its event can read full rows: the event owner, event organizers, the event `admin` role, and platform admins for event meetings. This matches `meetings.getOne` and `requireMeetingAccess`.
- **Timeline.** `project_meeting_timeline(project_id)` is a SECURITY DEFINER function with a fixed column list: id, name, status, start and end times, created time, score and `can_view_details`. It returns the rows the old policy showed (owner, event staff, judges of the meeting's event, project members), but never transcript URLs, recording URLs, summaries or category scores. Meetings whose event differs from the project's event are left out.
- **Client writes.** `authenticated` can insert only `name, user_id, agent_id, event_id, project_id` and update only `name, agent_id, event_id, project_id`. Status, timestamps, summary, scores and ids are written by the server (service role). Table grants and old column grants are both revoked.
- **Associations.** `meeting_associations_allowed(agent, event, project)` and the `validate_meeting_client_associations` trigger require the agent to be enabled and to belong to the event (directly or through `agent_events`). The caller must be in or manage the event, and the project must be in the same event with the caller on its team. Renames skip this check, so meetings whose agent was later disabled can still be renamed. Service-role and SECURITY DEFINER writes skip it too.
- **Auto conversations.** `create_auto_conversations_for_event_role` can no longer be called by `anon` or `authenticated`, since it inserts meetings for any user id. The `user_event_roles` trigger still creates TODO conversations.

## Deployment order

1. Apply the migration to production.
2. Then merge and deploy the app.

The migration is safe to apply before the app deploy. The previous app writes only the granted columns, and readers that lose rows get fewer rows, not errors. The new app is **not** safe before the migration, because it calls `project_meeting_timeline` and `meeting_associations_allowed`. Without them, the project timeline shows an error and creating or re-linking a meeting fails with "Unable to verify meeting associations".

After applying, check in production:

- A teammate's or judge's project page shows the timeline without a "View" link.
- The meeting owner can still open `/learn/<id>`.
- Organizers still see agent scores on the event's scores tab.
- Creating a meeting from `/learn` still works.

## Tests

```sh
python3 scripts/test_meeting_database.py
```

This runs in a disposable PostgreSQL 16.15 container with no network and tmpfs storage, and never touches a deployed database. It applies the real `main` migrations that shape meetings access (agents, meetings, project RLS, auto conversations, agent_events, `202611030002`, `202611060401`, `202611091101`) on a reduced fixture. It confirms the teammate/judge full-row read before the migration. Then it applies `202611110401` twice and checks:

- the full-row read matrix and the timeline matrix;
- denied columns and stale grants;
- association rules;
- update and delete filtering;
- that service-role processing writes still work, and that 16 concurrent claims have exactly one winner;
- the auto-conversation ACL and the real role trigger.

It runs in the `scraper-quota` job in [validation.yml](../../.github/workflows/validation.yml).

## Limits

Direct client inserts with the permitted columns still skip the app-only session-cap check. Stream video/chat authorization is a separate boundary.
