# Notifications and Project Invites - Database Schema Documentation

This document describes the new database tables and workflows for the invitation and notification system.

## Overview

The system now supports:
- **Notifications**: Central notification system for users
- **Project Invites**: Trackable project invitations with status management
- **One-tap workflow**: Users can accept invites seamlessly and be redirected to projects

## Database Tables

### 1. `notifications` Table

Stores all user notifications across the platform.

#### Schema

```sql
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Notification content
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    
    -- Related entities
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.events(event_id) ON DELETE CASCADE,
    
    -- Action and metadata
    action_url TEXT,
    metadata JSONB,
    
    -- Status tracking
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);
```

#### Notification Types (Enum)

```typescript
type NotificationType = 
  | "project_invite"           // User invited to a project
  | "event_update"             // General event update
  | "event_schedule_update"    // Schedule change
  | "event_custom_update"      // Custom notification
  | "feedback_received"        // Feedback on project
  | "project_submission"       // Project submitted
  | "system_announcement"      // Platform announcement
```

#### Key Features

- **Auto-timestamping**: `read_at` is automatically set when `is_read` changes to true
- **Flexible metadata**: Store additional context in JSONB format
- **Optional expiration**: Notifications can have an expiration date
- **Row-level security**: Users can only see/manage their own notifications

#### Example Usage

```typescript
// Create a notification
const { data, error } = await supabase
  .from('notifications')
  .insert({
    user_id: userId,
    type: 'project_invite',
    title: 'Project Invitation',
    message: `You were invited to ${projectName} at ${eventName}`,
    project_id: projectId,
    event_id: eventId,
    action_url: `/projects/join/${projectId}/${token}`,
    metadata: {
      invite_id: inviteId,
      invited_by: inviterName
    }
  });

// Mark as read
const { error } = await supabase
  .from('notifications')
  .update({ is_read: true })
  .eq('id', notificationId);

// Get unread notifications
const { data } = await supabase
  .from('notifications')
  .select('*')
  .eq('user_id', userId)
  .eq('is_read', false)
  .order('created_at', { ascending: false });
```

---

### 2. `project_invites` Table

Tracks project invitations and their acceptance status.

#### Schema

```sql
CREATE TABLE public.project_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Core references
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.events(event_id) ON DELETE CASCADE,
    
    -- Invitee information
    invitee_email TEXT NOT NULL,
    invitee_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Inviter information
    invited_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invited_by_name TEXT,
    invited_by_email TEXT,
    
    -- Invite details
    status invite_status NOT NULL DEFAULT 'pending',
    invite_token TEXT NOT NULL UNIQUE,
    invite_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    declined_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB
);
```

#### Invite Status (Enum)

```typescript
type InviteStatus = 
  | "pending"    // Invite sent, awaiting response
  | "accepted"   // Invite accepted
  | "declined"   // Invite declined
  | "expired"    // Invite expired
  | "revoked"    // Invite revoked by sender
```

#### Key Features

- **Auto-linking**: When a user signs up with an invited email, `invitee_user_id` is automatically populated
- **Auto-notification**: Creating a pending invite automatically creates a notification
- **Auto-timestamping**: `accepted_at`/`declined_at` set automatically on status change
- **Unique constraint**: Only one pending invite per email per project
- **Row-level security**: Users see invites sent to them, project members see all invites for their projects

#### Automatic Triggers

**1. Link User on Signup**
```sql
-- When a user signs up, link pending invites to their user_id
CREATE TRIGGER trigger_link_project_invite_to_user
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION link_project_invite_to_user();
```

**2. Create Notification on Invite**
```sql
-- When a pending invite is created, create a notification
CREATE TRIGGER trigger_create_project_invite_notification
    AFTER INSERT ON public.project_invites
    FOR EACH ROW
    WHEN (NEW.status = 'pending')
    EXECUTE FUNCTION create_project_invite_notification();
```

#### Example Usage

```typescript
import { generateEmailInviteHash } from '@/lib/utils/invite-links';

// Create an invite
const inviteToken = generateEmailInviteHash(projectId, inviteeEmail);

const { data, error } = await supabase
  .from('project_invites')
  .insert({
    project_id: projectId,
    event_id: eventId,
    invitee_email: inviteeEmail,
    invitee_user_id: inviteeUserId, // if known
    invited_by_user_id: currentUserId,
    invited_by_name: currentUserName,
    invited_by_email: currentUserEmail,
    invite_token: inviteToken,
    status: 'pending'
  });

// Accept an invite
const { error } = await supabase
  .from('project_invites')
  .update({ 
    status: 'accepted'
    // accepted_at is set automatically by trigger
  })
  .eq('id', inviteId)
  .eq('invitee_email', userEmail);

// Get pending invites for a user
const { data } = await supabase
  .from('project_invites')
  .select('*, projects(*), events(*)')
  .eq('invitee_email', userEmail)
  .eq('status', 'pending');

// Get all invites for a project
const { data } = await supabase
  .from('project_invites')
  .select('*')
  .eq('project_id', projectId)
  .order('created_at', { ascending: false });
```

---

## Workflow: Magic Link Project Invitation

### User Experience Flow

1. **User receives invite email** with magic link: `/projects/join/{projectId}/{token}`

2. **User clicks link**:
   - If not authenticated → redirected to login with `returnUrl`
   - If authenticated → continues to join flow

3. **On `/projects` page**:
   - Checks for pending invites for user's email
   - Displays **Draft Projects** section at top
   - Shows invited project with **"Pending invite"** badge
   - Shows notification banner with Accept/Dismiss actions

4. **User clicks "Accept & Open"**:
   - Updates `project_invites.status` to 'accepted'
   - Adds user to `projects.teammates` array
   - Joins event if needed (adds to `user_event_roles`)
   - Marks notification as read
   - Redirects to project page

5. **User clicks "Dismiss"**:
   - Updates `project_invites.status` to 'declined'
   - Marks notification as read
   - Removes from draft projects section

### Implementation Example

```typescript
// Check for pending invites on /projects page
async function checkPendingInvites(userEmail: string) {
  const { data: invites } = await supabase
    .from('project_invites')
    .select(`
      *,
      projects (*),
      events (*)
    `)
    .eq('invitee_email', userEmail)
    .eq('status', 'pending');
  
  return invites;
}

// Accept invite and join project
async function acceptInvite(inviteId: string, userId: string, userEmail: string) {
  // Start transaction-like operations
  
  // 1. Update invite status
  await supabase
    .from('project_invites')
    .update({ status: 'accepted' })
    .eq('id', inviteId);
  
  // 2. Get invite details
  const { data: invite } = await supabase
    .from('project_invites')
    .select('*, projects(*)')
    .eq('id', inviteId)
    .single();
  
  // 3. Add to project teammates
  const currentTeammates = invite.projects.teammates || [];
  if (!currentTeammates.includes(userEmail)) {
    await supabase
      .from('projects')
      .update({ 
        teammates: [...currentTeammates, userEmail] 
      })
      .eq('id', invite.project_id);
  }
  
  // 4. Join event if needed
  if (invite.event_id) {
    const { data: existingRole } = await supabase
      .from('user_event_roles')
      .select('*')
      .eq('user_id', userId)
      .eq('event_id', invite.event_id)
      .single();
    
    if (!existingRole) {
      await supabase
        .from('user_event_roles')
        .insert({
          user_id: userId,
          event_id: invite.event_id,
          role: 'participant'
        });
    }
  }
  
  // 5. Mark notification as read
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('metadata->>invite_id', inviteId);
  
  return { success: true, projectId: invite.project_id };
}
```

---

## Migration Files

- **`20251018_create_notifications_table.sql`**: Creates notifications table with RLS and triggers
- **`20251018_create_project_invites_table.sql`**: Creates project_invites table with RLS, triggers, and auto-linking

## Security Features

### Row-Level Security (RLS)

Both tables have comprehensive RLS policies:

**Notifications:**
- Users can only view/update/delete their own notifications
- System can insert notifications for any user

**Project Invites:**
- Users can view invites sent to their email
- Project members can view all invites for their projects
- Users can accept/decline invites sent to them
- Project members can create/revoke invites

### Data Integrity

- Unique constraint ensures one pending invite per email per project
- Status validation ensures proper timestamps
- Automatic cleanup on cascade deletes
- Secure token generation for invite links

## Performance Optimization

Both tables include strategic indexes:

```sql
-- Notifications indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- Project invites indexes  
CREATE INDEX idx_project_invites_pending_by_email ON project_invites(invitee_email, status) WHERE status = 'pending';
```

---

## Testing Checklist

- [ ] Create invite for new user (no account)
- [ ] User signs up → invite auto-links to user_id
- [ ] Notification appears on user's dashboard
- [ ] Accept invite → user added to project
- [ ] Accept invite → user joined to event
- [ ] Decline invite → status updated
- [ ] Multiple invites for same user display correctly
- [ ] Expired invites don't appear in pending
- [ ] RLS prevents unauthorized access
- [ ] Performance is good with 100+ invites

---

## Next Steps for Integration

1. **Update API endpoints**:
   - Modify `/api/projects/invite-teammate` to create `project_invites` record
   - Create `/api/notifications` endpoints (list, mark as read, dismiss)
   - Create `/api/project-invites/accept` and `/api/project-invites/decline`

2. **Update UI components**:
   - Create `<NotificationBell>` component for header
   - Create `<DraftProjects>` section for `/projects` page
   - Add "Pending invite" badge to project cards
   - Create notification toast/banner component

3. **Update project join flow**:
   - Modify `/projects/join/[id]/[token]/page.tsx` to check `project_invites` table
   - Add automatic event joining logic
   - Add context preservation after authentication

4. **Add real-time subscriptions**:
   - Subscribe to notifications table for live updates
   - Update UI when new invites arrive

---

## TypeScript Types

Types are available in `lib/database.types.ts`:

```typescript
import { Tables, Enums } from '@/lib/database.types';

type Notification = Tables<'notifications'>;
type ProjectInvite = Tables<'project_invites'>;
type NotificationType = Enums<'notification_type'>;
type InviteStatus = Enums<'invite_status'>;
```
