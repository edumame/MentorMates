# Responses API CLI Testing Guide

This guide explains how to test the conversational-agent migration to the Responses API.

## What was migrated

- Route: `/app/api/webhook/route.ts`
- Event path: `message.new`
- Old behavior: `openaiClient.chat.completions.create(...)`
- New behavior: `openaiClient.responses.create(...)`

## Prerequisites

1. Install dependencies:

```bash
pnpm install
```

2. Set required environment variables for local app execution:

```bash
export OPENAI_API_KEY="sk-..."
export NEXT_PUBLIC_STREAM_CHAT_API_KEY="..."
export STREAM_CHAT_SECRET_KEY="..."
export NEXT_PUBLIC_STREAM_VIDEO_API_KEY="..."
export STREAM_VIDEO_SCRET_KEY="..."
# Optional: enable/disable tools in chat route (default web search = enabled)
export OPENAI_CHAT_ENABLE_WEB_SEARCH="true"
# Optional: comma-separated vector store ids for file_search tool
export OPENAI_FILE_SEARCH_VECTOR_STORE_IDS=""
# Optional: tool-choice policy for chat route: required | auto | none
# default in code is "required" so tool calls are actively invoked
export OPENAI_CHAT_TOOL_CHOICE="required"
# Optional: log tool call types in server logs (e.g. ["web_search_call"])
export OPENAI_CHAT_LOG_TOOL_CALLS="true"
# Optional: max number of message attachments forwarded to Responses input
export OPENAI_CHAT_MAX_ATTACHMENT_INPUTS="3"
```

Notes:
- This codebase currently uses `STREAM_VIDEO_SCRET_KEY` (spelling in source), not `STREAM_VIDEO_SECRET_KEY`.
- You only need additional Supabase env vars if your local app requires them for route execution.
- With default `OPENAI_CHAT_TOOL_CHOICE="required"`, each chat turn with enabled tools triggers tool use.

3. Start the app:

```bash
pnpm dev
```

## Test 1: Direct OpenAI Responses smoke test

Use this to confirm your API key and Responses endpoint are working:

```bash
curl -s https://api.openai.com/v1/responses \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-5",
    "input": "Reply with exactly RESPONSES_OK"
  }' | jq -r '.output_text'
```

Expected output:

```text
RESPONSES_OK
```

## Test 2: Direct tool-calling smoke test (web search)

Use this to confirm tool calling works with Responses:

```bash
curl -s https://api.openai.com/v1/responses \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-5",
    "input": "What are two current headlines about AI this week? Keep it short.",
    "tools": [
      { "type": "web_search_preview" }
    ]
  }' | jq -r '.output_text'
```

## Test 3: End-to-end webhook route test from CLI

This test exercises your local `/api/webhook` route and the migrated `responses.create(...)` path.

### Step 1: Pick a meeting/channel id

Use an existing `meetings.id` from your database. The route expects:
- `channel_id = meetings.id`
- `status = upcoming` or `completed`

### Step 2: Send a signed `message.new` webhook

Use the helper script:

```bash
chmod +x scripts/test-webhook-message-new.sh
scripts/test-webhook-message-new.sh "<meeting_id>" "cli-test-user" "Test responses migration"
```

The script will:
- Build a `message.new` payload
- Generate `x-signature` using `STREAM_VIDEO_SCRET_KEY`
- POST to `http://localhost:3000/api/webhook`

Expected response:

```text
HTTP/1.1 200 OK
...
{"status":"ok"}
```

### Step 3: Validate behavior

1. Check your Next.js terminal logs for errors.
2. Open the chat UI for that meeting/channel and confirm an assistant reply appears.
3. If `OPENAI_CHAT_LOG_TOOL_CALLS=true`, confirm log entries include `web_search_call`.
4. Confirm dedupe behavior by reusing the same message id:
   - The route should return `{"status":"duplicate_ignored"}`.

## Test 4: End-to-end webhook test with attachment (Stream-compatible file input)

This uses the same webhook flow but includes a file attachment URL in the message payload.

```bash
ATTACHMENT_URL="https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" \
ATTACHMENT_TYPE="file" \
scripts/test-webhook-message-new.sh "<meeting_id>" "cli-test-user" "Summarize the attached file and cross-check one fact on the web."
```

Notes:
- The route forwards Stream attachments to OpenAI as `input_file`/`input_image`.
- Stream still transports the message; tool calling happens in your server route.

## Optional: Manual curl version (without helper script)

```bash
MESSAGE_ID="cli-test-$(date +%s)"
MEETING_ID="<meeting_id>"
TEST_USER_ID="cli-test-user"
TEXT="Test responses migration"

jq -n \
  --arg meeting_id "$MEETING_ID" \
  --arg user_id "$TEST_USER_ID" \
  --arg message_id "$MESSAGE_ID" \
  --arg text "$TEXT" \
  '{
    type: "message.new",
    channel_id: $meeting_id,
    user: { id: $user_id },
    message: { id: $message_id, text: $text }
  }' > /tmp/webhook-message.new.json

SIG=$(openssl dgst -sha256 -hmac "$STREAM_VIDEO_SCRET_KEY" /tmp/webhook-message.new.json | awk "{print \$2}")

curl -i "http://localhost:3000/api/webhook" \
  -H "content-type: application/json" \
  -H "x-api-key: local-test" \
  -H "x-signature: $SIG" \
  --data-binary @/tmp/webhook-message.new.json
```

## Troubleshooting

- `401 Invalid signature`: verify `STREAM_VIDEO_SCRET_KEY` and that signature is computed from the exact raw JSON payload bytes sent.
- `404 Meeting not found`: `channel_id` is not a valid `meetings.id` with expected status.
- `404 Agent not found`: the meeting’s `agent_id` does not exist.
- `status: duplicate_ignored`: message id was already processed in current server process.

## References

- OpenAI Responses docs: <https://platform.openai.com/docs/api-reference/responses>
- Stream webhook signature overview: <https://getstream.io/chat/docs/node/webhooks_overview/>
