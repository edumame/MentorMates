Test scripts in this folder:

- JavaScript scripts: `node {script_name}.js`
- Webhook migration smoke test: `bash scripts/test-webhook-message-new.sh "<meeting_id>" "cli-test-user" "Test responses migration"`
- Attachment smoke test: `ATTACHMENT_URL="https://.../sample.pdf" ATTACHMENT_TYPE="file" bash scripts/test-webhook-message-new.sh "<meeting_id>" "cli-test-user" "Summarize attached file"`

For full CLI testing instructions, see `/RESPONSES_CLI_TESTING.md`.
