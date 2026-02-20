#!/usr/bin/env bash
set -euo pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required but not installed." >&2
  exit 1
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "Error: openssl is required but not installed." >&2
  exit 1
fi

if [[ $# -lt 3 || $# -gt 4 ]]; then
  echo "Usage: $0 <meeting_id> <user_id> <text> [webhook_url]" >&2
  echo "Example: $0 \"<meeting_id>\" \"cli-test-user\" \"Test responses migration\"" >&2
  echo "Optional env: ATTACHMENT_URL=\"https://.../sample.pdf\" ATTACHMENT_TYPE=\"file|image\"" >&2
  exit 1
fi

if [[ -z "${STREAM_VIDEO_SCRET_KEY:-}" ]]; then
  echo "Error: STREAM_VIDEO_SCRET_KEY is required." >&2
  exit 1
fi

MEETING_ID="$1"
USER_ID="$2"
TEXT="$3"
WEBHOOK_URL="${4:-http://localhost:3000/api/webhook}"
MESSAGE_ID="cli-test-$(date +%s)"
ATTACHMENT_URL="${ATTACHMENT_URL:-}"
ATTACHMENT_TYPE="${ATTACHMENT_TYPE:-file}"
TMP_BODY="$(mktemp)"

cleanup() {
  rm -f "$TMP_BODY"
}
trap cleanup EXIT

jq -n \
  --arg meeting_id "$MEETING_ID" \
  --arg user_id "$USER_ID" \
  --arg message_id "$MESSAGE_ID" \
  --arg text "$TEXT" \
  --arg attachment_url "$ATTACHMENT_URL" \
  --arg attachment_type "$ATTACHMENT_TYPE" \
  '{
    type: "message.new",
    channel_id: $meeting_id,
    user: { id: $user_id },
    message: (
      { id: $message_id, text: $text } +
      (
        if ($attachment_url | length) > 0 then
          {
            attachments: [
              (
                if ($attachment_type | ascii_downcase) == "image" then
                  { type: "image", image_url: $attachment_url, asset_url: $attachment_url }
                else
                  { type: $attachment_type, asset_url: $attachment_url }
                end
              )
            ]
          }
        else
          {}
        end
      )
    )
  }' > "$TMP_BODY"

SIG="$(openssl dgst -sha256 -hmac "$STREAM_VIDEO_SCRET_KEY" "$TMP_BODY" | awk '{print $2}')"

echo "Posting webhook payload:"
cat "$TMP_BODY"
echo
echo "Computed x-signature: $SIG"
echo "Webhook URL: $WEBHOOK_URL"

curl -i "$WEBHOOK_URL" \
  -H "content-type: application/json" \
  -H "x-api-key: local-test" \
  -H "x-signature: $SIG" \
  --data-binary @"$TMP_BODY"
