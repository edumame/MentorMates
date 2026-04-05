# MentorMates Organizer Skill

> Manage your MentorMates hackathon event directly from Claude Code.
> Accept/reject participants, view projects, message judges, and update event details — all through your agent.

## Setup

1. Get your API key from the MentorMates dashboard (Event Settings → API Keys → Generate Key)
2. Set it as an environment variable:
   ```bash
   export MENTORMATES_API_KEY="mm_sk_..."
   export MENTORMATES_EVENT_ID="<event_uuid>"
   # Optional: override base URL for demo/staging environments
   export MENTORMATES_BASE_URL="https://demo.mentormates.ai"
   ```
3. Or add to your `.claude` project config.

## Configuration

- **API Base URL**: `${MENTORMATES_BASE_URL:-https://www.mentormates.ai}/api/agent` (defaults to production; set `MENTORMATES_BASE_URL` to override)
- **Authentication**: `Authorization: Bearer $MENTORMATES_API_KEY`
- **Event Selection**: add `?event_id=$MENTORMATES_EVENT_ID` to all `/api/agent/events*` routes except the discovery form of `GET /api/agent/events`

## Available Commands

### Event Overview
Get a summary of your event — participant counts, project counts, pending approvals.
```
GET /api/agent/events?event_id=<event_uuid>
```

### Discover Editable Events
If you have a reusable key and do not know the event ID yet, omit `event_id` on the overview route to get a paginated list of editable events.
```
GET /api/agent/events?limit=20&offset=0
```

### Update Event
Modify event details (name, description, dates, capacity, etc).
```
PATCH /api/agent/events?event_id=<event_uuid>
Body: { "event_name": "...", "event_description": "...", ... }
```

### List Participants
View all participants, mentors, judges, and organizers.
```
GET /api/agent/events/participants?event_id=<event_uuid>&role=participant&limit=100&offset=0
```

### Manage Participants
Change a participant's role or remove them from the event.
```
PATCH /api/agent/events/participants?event_id=<event_uuid>
Body: { "user_id": "...", "action": "change_role", "role": "judge" }
Body: { "user_id": "...", "action": "remove" }
```

### View Approval Requests
See pending requests from people wanting to join your event.
```
GET /api/agent/events/approval-requests?event_id=<event_uuid>&status=pending
```

### Approve / Reject Requests
Accept or deny a participant's request to join.
```
POST /api/agent/events/approval-requests?event_id=<event_uuid>
Body: { "request_id": "...", "action": "approve" }
Body: { "request_id": "...", "action": "reject", "rejection_reason": "..." }
```

### View Projects
List all submitted projects with their scores.
```
GET /api/agent/events/projects?event_id=<event_uuid>&submitted=true&limit=50
```

### View Judges
See judges and their scoring progress.
```
GET /api/agent/events/judges?event_id=<event_uuid>
```

### Send Info to Judges
Send an email update to all judges or specific ones.
```
POST /api/agent/events/judges?event_id=<event_uuid>
Body: { "message": "Scoring deadline is Friday 5pm", "subject": "Reminder" }
Body: { "judge_ids": ["..."], "message": "..." }
```

## Roles

| Role | Description |
|------|-------------|
| `participant` | Submit and manage projects |
| `mentor` | Give feedback on projects |
| `judge` | Score projects |
| `organizer` | Full event management |
| `admin` | Everything, all events |

## Event Visibility Values

`draft`, `private`, `public`, `demo`, `test`, `archived`

## Updatable Event Fields (PATCH)

| Field | Type | Example |
|-------|------|---------|
| `event_name` | string | "AI Hackathon 2026" |
| `event_description` | string (markdown) | "Build AI tools..." |
| `event_blurb` | string | "24-hour hackathon" |
| `event_date` | string | "2026-04-15" |
| `location` | string | "San Francisco, CA" |
| `submission_time_start` | ISO string or null | "2026-04-10T12:00:00Z" |
| `submission_time_cutoff` | ISO string or null | "2026-04-15T17:00:00Z" |
| `participant_capacity` | number or null | 100 |
| `require_participant_approval` | boolean | true |

## Usage Tips

- Start with "Get my event overview" to see the current state
- If you are using a reusable key and do not know the event ID yet, first ask for the editable event list
- Use "Show me pending approval requests" to review who wants to join
- Use "Approve all pending participants" for batch operations
- Ask "Which judges haven't finished scoring?" to check progress
- Use "Send judges a reminder about the scoring deadline" to communicate

## Scopes

Your API key may be configured with specific scopes:
- `event:read` — View event details
- `event:write` — Modify event details
- `participants:read` — View participants, judges, approval requests
- `participants:write` — Accept/reject participants, change roles, send emails
- `projects:read` — View projects and scores
- `projects:write` — Manage projects (future)
