Test scripts in this folder:

- JavaScript scripts: `node {script_name}.js`
- Webhook migration smoke test: `bash scripts/test-webhook-message-new.sh "<meeting_id>" "cli-test-user" "Test responses migration"`
- Attachment smoke test: `ATTACHMENT_URL="https://.../sample.pdf" ATTACHMENT_TYPE="file" bash scripts/test-webhook-message-new.sh "<meeting_id>" "cli-test-user" "Summarize attached file"`
- Participant `agent/me` API read smoke test:
  `MENTORMATES_PARTICIPANT_API_KEY="mm_sk_..." MENTORMATES_EVENT_REF="my-event-slug" bash scripts/test-agent-participant-api.sh smoke`
- Participant `agent/me` API write smoke test:
  `MENTORMATES_PARTICIPANT_API_KEY="mm_sk_..." MENTORMATES_EVENT_REF="my-event-slug" MENTORMATES_PROJECT_NAME="CLI smoke project" bash scripts/test-agent-participant-api.sh smoke-write`
- Participant `agent/me` API event listing:
  `MENTORMATES_PARTICIPANT_API_KEY="mm_sk_..." bash scripts/test-agent-participant-api.sh list-events`
- Participant `agent/me` API join test:
  `MENTORMATES_PARTICIPANT_API_KEY="mm_sk_..." bash scripts/test-agent-participant-api.sh join-event "my-event-slug"`
- Participant `agent/me` API project body preview:
  `MENTORMATES_PROJECT_NAME="CLI smoke project" bash scripts/test-agent-participant-api.sh print-project-body`
- Participant `agent/me` API project create test:
  `MENTORMATES_PARTICIPANT_API_KEY="mm_sk_..." MENTORMATES_EVENT_REF="my-event-slug" MENTORMATES_PROJECT_NAME="CLI smoke project" bash scripts/test-agent-participant-api.sh create-project`
- Participant `agent/me` API project create test from a JSON file:
  `MENTORMATES_PARTICIPANT_API_KEY="mm_sk_..." MENTORMATES_EVENT_REF="my-event-slug" bash scripts/test-agent-participant-api.sh submit-project-file`
- Participant `agent/me` API project create test from a custom JSON file:
  `MENTORMATES_PARTICIPANT_API_KEY="mm_sk_..." MENTORMATES_EVENT_REF="my-event-slug" MENTORMATES_PROJECT_BODY_FILE="scripts/participant-project-submission.example.json" bash scripts/test-agent-participant-api.sh submit-project-file`
- Participant `agent/me` API project update test:
  `MENTORMATES_PARTICIPANT_API_KEY="mm_sk_..." MENTORMATES_EVENT_REF="my-event-slug" MENTORMATES_PROJECT_ID="<project_uuid>" bash scripts/test-agent-participant-api.sh update-project`
- Sample submission body file:
  `scripts/participant-project-submission.example.json`
- Direct curl using an event ref:
  `curl -sS -X POST -H "Authorization: Bearer $MENTORMATES_PARTICIPANT_API_KEY" -H "Content-Type: application/json" --data @scripts/participant-project-submission.example.json "$MENTORMATES_BASE_URL/api/agent/me/events/$MENTORMATES_EVENT_REF/projects" | jq .`

For full CLI testing instructions, see [docs/responses-cli-testing.md](../docs/responses-cli-testing.md).
