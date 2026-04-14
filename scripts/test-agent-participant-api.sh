#!/usr/bin/env bash
set -euo pipefail

if ! command -v curl >/dev/null 2>&1; then
  echo "Error: curl is required but not installed." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required but not installed." >&2
  exit 1
fi

BASE_URL="${MENTORMATES_BASE_URL:-http://localhost:3000}"
API_BASE="${BASE_URL%/}/api/agent/me/events"
API_KEY="${MENTORMATES_PARTICIPANT_API_KEY:-${MM_PARTICIPANT_KEY:-}}"
DEFAULT_EVENT_REF="${MENTORMATES_EVENT_REF:-${MENTORMATES_EVENT_ID:-}}"
DEFAULT_PROJECT_ID="${MENTORMATES_PROJECT_ID:-}"
DEFAULT_PROJECT_BODY_FILE="${MENTORMATES_PROJECT_BODY_FILE:-scripts/participant-project-submission.example.json}"
DEFAULT_PROJECT_NAME="${MENTORMATES_PROJECT_NAME:-CLI Participant Smoke Test $(date '+%Y-%m-%d %H:%M:%S')}"
DEFAULT_PROJECT_DESCRIPTION="${MENTORMATES_PROJECT_DESCRIPTION:-Created by scripts/test-agent-participant-api.sh}"
DEFAULT_LEAD_NAME="${MENTORMATES_LEAD_NAME:-}"
DEFAULT_LEAD_EMAIL="${MENTORMATES_LEAD_EMAIL:-}"
DEFAULT_TEAMMATES="${MENTORMATES_TEAMMATES:-}"
DEFAULT_PROJECT_URL="${MENTORMATES_PROJECT_URL:-https://example.com/project}"
DEFAULT_VIDEO_URL="${MENTORMATES_VIDEO_URL:-https://example.com/demo}"
DEFAULT_ADDITIONAL_MATERIALS_URL="${MENTORMATES_ADDITIONAL_MATERIALS_URL:-https://example.com/slides}"
DEFAULT_COVER_IMAGE_URL="${MENTORMATES_COVER_IMAGE_URL:-https://images.unsplash.com/photo-1516321318423-f06f85e504b3}"
DEFAULT_TRACK_IDS="${MENTORMATES_TRACK_IDS:-}"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/test-agent-participant-api.sh list-events
  bash scripts/test-agent-participant-api.sh join-event [event_ref]
  bash scripts/test-agent-participant-api.sh list-projects [event_ref]
  bash scripts/test-agent-participant-api.sh print-project-body
  bash scripts/test-agent-participant-api.sh create-project [event_ref]
  bash scripts/test-agent-participant-api.sh submit-project-file [event_ref] [body_file]
  bash scripts/test-agent-participant-api.sh update-project [event_ref] [project_id]
  bash scripts/test-agent-participant-api.sh smoke [event_ref]
  bash scripts/test-agent-participant-api.sh smoke-write [event_ref]

Required env:
  MENTORMATES_PARTICIPANT_API_KEY

Legacy env still supported:
  MM_PARTICIPANT_KEY

Optional env:
  MENTORMATES_BASE_URL
  MENTORMATES_EVENT_REF         UUID or unique slug
  MENTORMATES_EVENT_ID
  MENTORMATES_PROJECT_ID
  MENTORMATES_PROJECT_BODY_FILE
  MENTORMATES_PROJECT_NAME
  MENTORMATES_PROJECT_DESCRIPTION
  MENTORMATES_LEAD_NAME
  MENTORMATES_LEAD_EMAIL
  MENTORMATES_TEAMMATES          comma-separated emails
  MENTORMATES_PROJECT_URL
  MENTORMATES_VIDEO_URL
  MENTORMATES_ADDITIONAL_MATERIALS_URL
  MENTORMATES_COVER_IMAGE_URL
  MENTORMATES_TRACK_IDS          comma-separated UUIDs

Example direct curl:
  curl -sS -X POST \
    -H "Authorization: Bearer $MENTORMATES_PARTICIPANT_API_KEY" \
    -H "Content-Type: application/json" \
    --data @scripts/participant-project-submission.example.json \
    "$MENTORMATES_BASE_URL/api/agent/me/events/$MENTORMATES_EVENT_REF/projects" | jq .
EOF
}

require_api_key() {
  if [[ -z "$API_KEY" ]]; then
    echo "Error: MENTORMATES_PARTICIPANT_API_KEY is required." >&2
    exit 1
  fi
}

resolve_event_ref() {
  local cli_event_ref="${1:-}"
  local resolved="${cli_event_ref:-$DEFAULT_EVENT_REF}"
  if [[ -z "$resolved" ]]; then
    echo "Error: event_ref is required. Pass a UUID or slug, or set MENTORMATES_EVENT_REF." >&2
    exit 1
  fi
  printf '%s\n' "$resolved"
}

resolve_project_id() {
  local cli_project_id="${1:-}"
  local resolved="${cli_project_id:-$DEFAULT_PROJECT_ID}"
  if [[ -z "$resolved" ]]; then
    echo "Error: project_id is required. Pass it as an argument or set MENTORMATES_PROJECT_ID." >&2
    exit 1
  fi
  printf '%s\n' "$resolved"
}

resolve_project_body_file() {
  local cli_body_file="${1:-}"
  local resolved="${cli_body_file:-$DEFAULT_PROJECT_BODY_FILE}"
  if [[ -z "$resolved" ]]; then
    echo "Error: body_file is required. Pass it as an argument or set MENTORMATES_PROJECT_BODY_FILE." >&2
    exit 1
  fi
  if [[ ! -f "$resolved" ]]; then
    echo "Error: body_file '$resolved' does not exist." >&2
    exit 1
  fi
  printf '%s\n' "$resolved"
}

comma_separated_json_array() {
  local raw="${1:-}"
  if [[ -z "$raw" ]]; then
    printf '[]\n'
    return
  fi

  printf '%s' "$raw" | jq -R 'split(",") | map(gsub("^\\s+|\\s+$"; "")) | map(select(length > 0))'
}

request() {
  local method="$1"
  local url="$2"
  local body="${3:-}"

  echo
  echo ">>> ${method} ${url}"

  if [[ -n "$body" ]]; then
    echo ">>> body:"
    echo "$body" | jq .
    echo
    curl -sS -X "$method" "$url" \
      -H "Authorization: Bearer $API_KEY" \
      -H "Content-Type: application/json" \
      --data "$body" | jq .
  else
    curl -sS -X "$method" "$url" \
      -H "Authorization: Bearer $API_KEY" | jq .
  fi
}

request_file() {
  local method="$1"
  local url="$2"
  local body_file="$3"

  echo
  echo ">>> ${method} ${url}"
  echo ">>> body file: ${body_file}"
  echo ">>> body:"
  jq . "$body_file"
  echo

  curl -sS -X "$method" "$url" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    --data @"$body_file" | jq .
}

request_raw() {
  local method="$1"
  local url="$2"
  local body="${3:-}"

  echo
  echo ">>> ${method} ${url}" >&2

  if [[ -n "$body" ]]; then
    echo ">>> body:" >&2
    echo "$body" | jq . >&2
    echo >&2
    curl -sS -X "$method" "$url" \
      -H "Authorization: Bearer $API_KEY" \
      -H "Content-Type: application/json" \
      --data "$body"
  else
    curl -sS -X "$method" "$url" \
      -H "Authorization: Bearer $API_KEY"
  fi
}

build_create_project_body() {
  local teammates_json
  teammates_json="$(comma_separated_json_array "$DEFAULT_TEAMMATES")"

  local track_ids_json
  track_ids_json="$(comma_separated_json_array "$DEFAULT_TRACK_IDS")"

  jq -n \
    --arg project_name "$DEFAULT_PROJECT_NAME" \
    --arg project_description "$DEFAULT_PROJECT_DESCRIPTION" \
    --arg project_url "$DEFAULT_PROJECT_URL" \
    --arg video_url "$DEFAULT_VIDEO_URL" \
    --arg additional_materials_url "$DEFAULT_ADDITIONAL_MATERIALS_URL" \
    --arg cover_image_url "$DEFAULT_COVER_IMAGE_URL" \
    --arg lead_name "$DEFAULT_LEAD_NAME" \
    --arg lead_email "$DEFAULT_LEAD_EMAIL" \
    --argjson teammates "$teammates_json" \
    --argjson track_ids "$track_ids_json" \
    '{
      project_name: $project_name,
      project_description: $project_description,
      project_url: $project_url,
      video_url: $video_url,
      additional_materials_url: $additional_materials_url,
      cover_image_url: $cover_image_url,
      teammates: $teammates,
      artifacts: [
        {
          kind: "project_link",
          label: "Project Link",
          url: $project_url,
          sort_order: 0,
          is_primary: true
        },
        {
          kind: "video_link",
          label: "Demo Video",
          url: $video_url,
          sort_order: 1,
          is_primary: true
        },
        {
          kind: "additional_material",
          label: "Additional Material",
          url: $additional_materials_url,
          sort_order: 2,
          is_primary: true
        }
      ],
      submissionAnswers: []
    }
    + (if $lead_name != "" then {lead_name: $lead_name} else {} end)
    + (if $lead_email != "" then {lead_email: $lead_email} else {} end)
    + (if ($track_ids | length) > 0 then {track_ids: $track_ids} else {} end)
    | .artifacts |= map(select(.url != ""))'
}

list_events() {
  request GET "$API_BASE"
}

join_event() {
  local event_ref
  event_ref="$(resolve_event_ref "${1:-}")"
  request POST "$API_BASE/$event_ref/join"
}

list_projects() {
  local event_ref
  event_ref="$(resolve_event_ref "${1:-}")"
  request GET "$API_BASE/$event_ref/projects"
}

create_project() {
  local event_ref
  event_ref="$(resolve_event_ref "${1:-}")"

  local body
  body="$(build_create_project_body)"

  request POST "$API_BASE/$event_ref/projects" "$body"
}

submit_project_file() {
  local event_ref
  event_ref="$(resolve_event_ref "${1:-}")"

  local body_file
  body_file="$(resolve_project_body_file "${2:-}")"

  request_file POST "$API_BASE/$event_ref/projects" "$body_file"
}

print_project_body() {
  build_create_project_body | jq .
}

update_project() {
  local event_ref
  event_ref="$(resolve_event_ref "${1:-}")"

  local project_id
  project_id="$(resolve_project_id "${2:-}")"

  local body
  body="$(jq -n \
    --arg project_name "${DEFAULT_PROJECT_NAME} (updated)" \
    --arg project_description "${DEFAULT_PROJECT_DESCRIPTION} Updated via curl smoke test." \
    '{
      project_name: $project_name,
      project_description: $project_description
    }')"

  request PATCH "$API_BASE/$event_ref/projects/$project_id" "$body"
}

smoke() {
  local event_ref
  event_ref="$(resolve_event_ref "${1:-}")"

  list_events
  list_projects "$event_ref"
}

smoke_write() {
  local event_ref
  event_ref="$(resolve_event_ref "${1:-}")"

  local create_body
  create_body="$(build_create_project_body)"

  local create_response
  create_response="$(request_raw POST "$API_BASE/$event_ref/projects" "$create_body")"
  echo "$create_response" | jq .

  local project_id
  project_id="$(echo "$create_response" | jq -r '.project.id // empty')"
  if [[ -z "$project_id" ]]; then
    echo "Error: create-project did not return project.id; cannot continue smoke-write." >&2
    exit 1
  fi

  local update_body
  update_body="$(jq -n \
    --arg project_name "${DEFAULT_PROJECT_NAME} (agent/me update)" \
    --arg project_description "${DEFAULT_PROJECT_DESCRIPTION} Updated through /api/agent/me." \
    '{
      project_name: $project_name,
      project_description: $project_description
    }')"

  local update_response
  update_response="$(request_raw PATCH "$API_BASE/$event_ref/projects/$project_id" "$update_body")"
  echo "$update_response" | jq .
}

main() {
  local action="${1:-}"
  shift || true

  if [[ "$action" != "" && "$action" != "help" && "$action" != "-h" && "$action" != "--help" && "$action" != "print-project-body" ]]; then
    require_api_key
  fi

  case "$action" in
    list-events)
      list_events
      ;;
    join-event)
      join_event "${1:-}"
      ;;
    list-projects)
      list_projects "${1:-}"
      ;;
    print-project-body)
      print_project_body
      ;;
    create-project)
      create_project "${1:-}"
      ;;
    submit-project-file)
      submit_project_file "${1:-}" "${2:-}"
      ;;
    update-project)
      update_project "${1:-}" "${2:-}"
      ;;
    smoke)
      smoke "${1:-}"
      ;;
    smoke-write)
      smoke_write "${1:-}"
      ;;
    ""|-h|--help|help)
      usage
      ;;
    *)
      echo "Error: unknown action '$action'" >&2
      usage
      exit 1
      ;;
  esac
}

main "$@"
