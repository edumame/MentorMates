Test scripts in this folder:

- JavaScript scripts: `node {script_name}.js`
- Dev auth helper:
  - `pnpm auth:dev -- generate-link --email you@example.com --password password123`
  - `pnpm auth:dev -- confirm-user --email you@example.com`
  - `pnpm auth:dev -- create-confirmed-user --email you@example.com --password password123`
- Webhook migration smoke test: `bash scripts/test-webhook-message-new.sh "<meeting_id>" "cli-test-user" "Test responses migration"`
- Attachment smoke test: `ATTACHMENT_URL="https://.../sample.pdf" ATTACHMENT_TYPE="file" bash scripts/test-webhook-message-new.sh "<meeting_id>" "cli-test-user" "Summarize attached file"`

For full CLI testing instructions, see `/RESPONSES_CLI_TESTING.md`.
