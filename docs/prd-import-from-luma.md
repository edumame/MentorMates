# PRD: Import Participants from Luma

## Overview

Enable event organizers to import participant lists from Luma (lu.ma) via CSV upload, send email invitations with approval workflow, and track signup/invitation status.

## Problem Statement

Organizers often manage event registrations on Luma but need to onboard those participants into MentorMate. Currently, there's no way to bulk import participants, requiring manual invitation of each attendee.

## Goals

1. Allow organizers to upload a CSV export from Luma
2. Parse and validate participant data (name, email)
3. Preview imported data before sending invitations
4. Send customizable email invitations with organizer approval
5. Track invitation status (pending, sent, accepted, expired)
6. Handle edge cases (duplicates, existing users, invalid emails)

## User Stories

### As an organizer, I want to:
- Upload a Luma CSV export to import participants
- Preview the list of participants before sending invites
- Edit/remove individual entries before sending
- Customize the invitation email message
- Approve and send invitations in bulk or individually
- View the status of all sent invitations
- Resend invitations to participants who haven't responded
- See which imported participants have signed up

### As an invited participant, I want to:
- Receive a clear invitation email with event details
- Click a link to join the event directly
- Have my account auto-created or linked if I'm a new user

## Feature Scope

### Phase 1: CSV Upload & Parsing

**CSV Format Support:**
- Luma exports typically include: Name, Email, Status, Registration Date
- Support flexible column mapping (auto-detect common headers)
- Handle various CSV encodings (UTF-8, ISO-8859-1)

**Validation:**
- Email format validation
- Duplicate detection within upload
- Detection of existing users/invites

**UI Components:**
- File upload dropzone
- Column mapping interface (if auto-detect fails)
- Preview table with validation status per row
- Error summary with actionable fixes

### Phase 2: Invitation Approval & Sending

**Approval Workflow:**
- Default state: all imports are "pending approval"
- Organizer can approve all, approve selected, or approve individually
- Bulk actions: approve all, reject selected, clear all

**Email Customization:**
- Default invitation template with event details
- Customizable message body (optional)
- Preview email before sending

**Sending:**
- Send immediately upon approval
- Rate limiting to avoid email provider issues
- Queue system for large imports (via Inngest)

### Phase 3: Status Tracking

**Invitation Statuses:**
| Status | Description |
|--------|-------------|
| `pending` | Imported but not yet approved |
| `approved` | Approved, waiting to be sent |
| `sent` | Email sent, awaiting response |
| `accepted` | User clicked invite and joined event |
| `expired` | Invitation link expired (configurable, default 7 days) |
| `bounced` | Email delivery failed |
| `declined` | User explicitly declined (future) |

**Tracking Dashboard:**
- Summary stats: total imported, sent, accepted, pending
- Filterable/searchable list of all invitations
- Individual status with timestamps
- Resend action for sent/expired invitations

## Technical Design

### Database Schema

```sql
-- New table: event_invitations
CREATE TABLE event_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  invite_token UUID DEFAULT gen_random_uuid(),
  source TEXT DEFAULT 'manual', -- 'manual', 'luma_import', 'csv_import'
  source_metadata JSONB, -- store original CSV row data
  invited_by UUID REFERENCES auth.users(id),
  sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(event_id, email)
);

-- Index for token lookups
CREATE INDEX idx_event_invitations_token ON event_invitations(invite_token);
CREATE INDEX idx_event_invitations_event_status ON event_invitations(event_id, status);
```

### API Endpoints

```
POST   /api/events/[eventId]/invitations/import
       - Upload and parse CSV
       - Returns parsed data with validation results

POST   /api/events/[eventId]/invitations/approve
       - Approve selected invitations
       - Body: { invitationIds: string[], sendImmediately: boolean }

POST   /api/events/[eventId]/invitations/send
       - Send approved invitations
       - Triggers email queue via Inngest

GET    /api/events/[eventId]/invitations
       - List all invitations with filters
       - Query: status, search, page, limit

POST   /api/events/[eventId]/invitations/[id]/resend
       - Resend a specific invitation

DELETE /api/events/[eventId]/invitations/[id]
       - Delete/cancel an invitation

GET    /api/invitations/accept/[token]
       - Accept invitation and join event
       - Redirects to event page after auth
```

### Inngest Functions

```typescript
// Send invitation emails in batches
inngest.createFunction(
  { id: "send-invitation-emails" },
  { event: "invitation/send.batch" },
  async ({ event, step }) => {
    // Process invitations in batches of 10
    // Update status after each send
    // Handle bounces/failures
  }
);
```

### File Structure

```
features/
└── invitations/
    ├── components/
    │   ├── csv-upload-dropzone.tsx
    │   ├── import-preview-table.tsx
    │   ├── column-mapper.tsx
    │   ├── invitation-list.tsx
    │   ├── invitation-status-badge.tsx
    │   └── email-preview-dialog.tsx
    ├── hooks/
    │   ├── use-csv-parser.ts
    │   ├── use-invitations.ts
    │   └── use-invitation-stats.ts
    └── utils/
        ├── csv-parser.ts
        ├── luma-csv-adapter.ts
        └── email-validator.ts

app/
└── (users)/
    └── events/
        └── [id]/
            └── manage/
                └── invitations/
                    └── page.tsx
```

## UI/UX Flow

### Import Flow
1. Organizer navigates to Event → Manage → Invitations
2. Clicks "Import from CSV" button
3. Drags/drops or selects Luma CSV file
4. System parses and validates, shows preview table
5. Organizer reviews entries, fixes/removes invalid ones
6. Clicks "Import X Participants" to add to pending list

### Approval & Send Flow
1. From Invitations list, organizer sees pending imports
2. Selects participants to approve (or "Approve All")
3. Optionally customizes invitation message
4. Previews email, clicks "Send Invitations"
5. System queues emails, updates status to "sent"

### Tracking Flow
1. Organizer views Invitations dashboard
2. Sees summary cards: Pending, Sent, Accepted, Expired
3. Filters list by status
4. Clicks on individual to see details/resend

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Email already has account | Show as "existing user" - still send invite |
| Email already invited to event | Show duplicate warning, skip or update |
| Invalid email format | Mark row as error, require fix or removal |
| CSV encoding issues | Attempt multiple encodings, show error if all fail |
| Large CSV (>1000 rows) | Paginate preview, batch process |
| Email send failure | Mark as bounced, allow retry |
| User clicks expired link | Show expiry message with request new invite option |

## Success Metrics

- Time to import participants (target: <2 min for 100 participants)
- Invitation acceptance rate
- Email delivery success rate
- Reduction in manual invitation time

## Future Enhancements

- Direct Luma API integration (OAuth)
- Bulk import from other platforms (Eventbrite, Meetup)
- Automated reminder emails for pending invites
- Decline/unsubscribe handling
- Import history/audit log
