# MentorMates Organizer Skill

> Manage your MentorMates hackathon event directly from Claude Code.
> Accept/reject participants, view projects, message judges, and update event details — all through your agent.

## Setup

1. Get your API key from the MentorMates dashboard (Event Settings → API Keys → Generate Key)
2. Set it as an environment variable:
   ```bash
   export MENTORMATES_API_KEY="mm_sk_..."
   export MENTORMATES_EVENT_ID="<event_uuid>"
   ```
3. Or add to your `.claude` project config.

## Configuration

- **API Base URL**: `https://mentormates.ai/api/agent`
- **Authentication**: `Authorization: Bearer $MENTORMATES_API_KEY`
- **Event Selection**: add `?event_id=$MENTORMATES_EVENT_ID` to all event routes

## Available Commands

### Event Overview
Get a summary of your event — participant counts, project counts, pending approvals.
```
GET /api/agent/events?event_id=<event_uuid>
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

## Usage Tips

- Start with "Get my event overview" to see the current state
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
