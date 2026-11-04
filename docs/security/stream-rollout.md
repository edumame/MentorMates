# Stream access rollout and provider prerequisites

The application authorizes a meeting before minting tokens or creating provider resources. This code does not configure the deployed Stream applications, remove historical memberships, revoke existing tokens, or prove that provider-side permissions are private. **Keep production activation pending until the prerequisites and live authorization checks below are verified by an authorized operator.** No live vendor calls or credential inspection were performed during this review.

## Token and SDK boundaries

The installed `@stream-io/node-sdk` exposes `generateCallToken({ user_id, call_cids, exp, iat })`. The server explicitly provisions the authorized human caller as a member for existing and newly created calls before returning access. The application issues a Video call token for `default:<authorized meeting ID>`, with an explicit 15-minute expiration and issued-at timestamp. Human application callers are upserted as ordinary `user`, including application platform administrators; their meeting access comes from server authorization rather than a vendor-wide admin role.

**Video call tokens add access; they do not restrict privileges already granted by provider roles or memberships.** Stream explicitly documents this behavior. A singleton `call_cids` claim is insufficient if the ordinary user role can access other calls. Configure call permissions accordingly and test an unrelated call using the issued token. See [Stream authentication and call tokens](https://getstream.io/docs/platform/authentication/).

The installed `stream-chat` API is `createToken(userID, exp, iat)`. Chat tokens identify a user, not one channel; no channel-scoped token API is used or assumed. The application checks the requested meeting, ensures membership in `messaging:<meeting ID>`, and issues a 15-minute user token. **That token can also access other channels permitted for that identity.** Channel membership and effective provider permissions are the actual boundary. See [Stream Chat permission policies](https://getstream.io/chat/docs/node/chat-permission-policies/).

Server lookup uses `queryChannels` with `watch: false` and `state: false`; an empty successful result permits channel creation. A query failure is not evidence that a channel is missing. Video not-found handling must match the installed SDK's `StreamError.metadata.responseCode === 404`; permission, authentication, rate-limit and network failures must not trigger resource creation.

## Operator configuration before activation

1. Inventory the actual Stream Chat and Video applications, call/channel types, ordinary-user grants, channel/call overrides, ownership grants, and existing memberships. Confirm they match the IDs and types used by the application; do not assume vendor defaults are private.
2. For Video's `default` call type, remove broad ordinary-user access to unrelated calls. Grant required read/join/media permissions only to authorized call members. Prevent ordinary clients from creating arbitrary calls or managing membership, roles, permissions and other users. Check existing call-specific overrides as well as call-type defaults.
3. For Chat's `messaging` type, restrict reading, watching and messaging to authorized members. Prevent ordinary clients from creating arbitrary channels, adding themselves or others, modifying membership roles, or changing grants. Review ownership grants: a user recorded as channel creator must not gain unintended management powers. A client-side channel filter is not access control.
4. Test necessary meeting functionality with these least-privilege grants: server resource creation, authorized join/read/write/media, and SDK token refresh. Token refresh must return to the backend and reauthorize the meeting; do not substitute a global or permanent token.
5. Reconcile historical application-human identities that previously received vendor `admin`. Demote only verified application-human IDs according to the approved inventory, including application platform admins. Preserve separate legitimate vendor operational accounts and bot/service identities. Do not bulk-demote every provider user or assume upserting returning users fixes inactive legacy accounts.
6. Audit and revoke previously issued privileged or unbounded tokens using provider-supported controls and a planned cutoff. The installed Chat SDK supports `revokeUserToken(userID, before)`; choose cutoffs and account scope deliberately, and verify issued-at behavior and existing connections with the vendor. Revocation and refresh can interrupt active sessions. No token revocation has been executed by this code change.
7. Establish ongoing membership reconciliation for revoked application access, not just a one-time cleanup. Cover meeting ownership/event reassignment, event-role removal, account removal, and any other permission changes. Remove stale provider memberships and revoke affected tokens or sessions as needed; verify denials before treating reconciliation as complete. Provider credentials and webhook/event processing used for this must remain server-only.

## Stale-membership acceptance test

Use two disposable meetings, A and B, and a nonprivileged test user:

1. Authorize the user for A and open its chat/call.
2. Revoke the user's application access to A; execute the configured provider reconciliation/revocation procedure.
3. Authorize the same user for B and obtain a fresh token through B.
4. Attempt to read/watch/send in A and join/read A's call using B's token and any still-held A token. Both must be denied according to the operator's revocation policy; verify existing connections as well as new ones.

Without provider reconciliation, a fresh Chat token obtained for B may still read A through retained membership. Short token expiry and per-meeting issuance checks do not remove that access. Video tokens likewise do not erase previously granted membership or global-role permissions. If continuous reconciliation is not in place, document the residual and keep the claimed privacy rollout incomplete.

## Required deployment evidence

Record results without including tokens, secrets or user content:

- Anonymous, expired/invalid application session, wrong-event user, ordinary teammate without meeting-detail access, and missing meeting requests fail before any provider write or token issuance.
- Authorized owners and event-management roles retain the intended flows; standalone meetings do not become globally accessible through platform-admin status.
- A real ordinary provider identity cannot create arbitrary calls/channels, add members, elevate roles, or read/join an unrelated resource directly through the provider SDK.
- The stale-membership scenario above fails closed after revocation, including existing sessions.
- Token expiration and refresh work; revocation and legacy-admin inventory results are recorded. Separate bot and legitimate operational accounts remain functional.
- Video lookup errors other than a confirmed provider404 and failed Chat lookups do not cause resource creation.

Repository tests verify backend authorization ordering, token arguments, expiry, error handling and client integration with mocked SDKs. They do not prove deployed role grants, channel/call overrides, membership reconciliation, token revocation or live connection behavior. Vendor configuration and these acceptance results must be verified separately before claiming end-to-end Stream privacy.

## Rollback

Do not restore vendor-admin human tokens, permanent tokens, broad channel access or client-controlled membership as a rollback shortcut. If least-privilege configuration breaks a required feature, keep that feature unavailable while correcting the specific permission or server workflow. Preserve the database meeting boundary and server authorization checks.
