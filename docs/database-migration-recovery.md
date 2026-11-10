# Database migration recovery and forward deployment

The historical `supabase/migrations` directory is not a verified fresh-install baseline. Multiple files reuse version prefixes and the old profile-view script applies unsupported view RLS syntax. Do not run a reset against an existing database, rename versions already applied, or assume the 2025 schema dump represents the current application.

Run the read-only inventory check:

```sh
python3 scripts/check_migration_history.py
```

Its nonzero result is intentional while historical replay remains unresolved. Forward migrations added for the November audit use unique identifiers. Test their behavior without credentials using:

```sh
python3 scripts/test_admission_security.py
```

That test provisions a network-isolated disposable PostgreSQL Docker container and accepts no database URL. It exercises previous vulnerable policies before forward hardening, metadata versus password-hash access, moderation transitions, and competing last-seat admissions.

## Required before a fresh-install baseline can be declared valid

1. Obtain an authorized, schema-only export and migration inventory from the intended deployment. Exclude data, secrets, user identifiers and provider credentials.
2. Reconcile the inventory with checked-in scripts. Keep deployed migration IDs intact. Record superseded scripts separately rather than renumbering them in place.
3. Build a clean baseline from the reviewed effective schema, privileges, policies, functions and storage definitions. Ensure views use supported permission mechanisms rather than table RLS syntax.
4. In a disposable Supabase environment, apply that baseline and all forward migrations. Run the SQL permission/concurrency tests and representative application tests. Separately test upgrade from the representative prior schema.
5. Only then document the supported fresh-install and upgrade commands and wire them into CI.

The baseline cannot safely be invented from incomplete historical files. SEC-006 remains blocked until these inputs and replay evidence exist; this runbook and inventory guard are mitigation, not proof that replay is fixed.

## November admission hardening rollout

Do not deploy the combined audit application before its database dependencies exist. The new code immediately requires checkout, chat, booking, voting, project-join and ticket-claim RPCs plus the meeting provisioning column. Conversely, applying admission/payment permission revocations before replacing the old writers breaks the old application. This combined release requires a reviewed maintenance cutover (pause affected writes and retryable webhooks, validate the target schema, apply all eight forward migrations in order, deploy the matching application and worker configuration, run staging/smoke checks, then resume) or a separately designed expand/contract rollout. A merge that automatically deploys must wait until that cutover is arranged and verified. The shared worker secret must be configured on both services. Never apply production SQL as part of local regression tests.

Private events can be used without public-listing approval. Draft/rejected events and unapproved public events cannot use open enrollment. Explicit invitation/organizer assignment paths remain separate authorized operations.
