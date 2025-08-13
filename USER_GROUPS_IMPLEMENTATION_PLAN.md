# User Groups Implementation Plan

## Overview

This document outlines the implementation plan for adding user groups functionality to the event management platform, similar to Luma's feature where event organizers can create user groups from past events and blast out new event announcements to those groups.

## Feature Requirements

### Core Functionality
- **Group Creation**: Organizers can create user groups from past event participants
- **Group Management**: Add/remove users, edit group details, archive groups
- **Event Broadcasting**: Send new event announcements to specific user groups
- **Group Analytics**: Track engagement and response rates
- **User Preferences**: Users can manage their group membership preferences

## Database Schema Changes

### 1. New Tables

#### `user_groups` Table
```sql
CREATE TABLE user_groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES user_profiles(uid) ON DELETE CASCADE,
    created_from_event_id UUID REFERENCES events(event_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    group_type group_type_enum DEFAULT 'manual',
    tags JSONB DEFAULT '[]'::jsonb,
    
    -- Constraints
    CONSTRAINT user_groups_name_creator_unique UNIQUE(name, created_by)
);

-- Create enum for group types
CREATE TYPE group_type_enum AS ENUM ('manual', 'event_based', 'role_based');

-- Indexes
CREATE INDEX idx_user_groups_created_by ON user_groups(created_by);
CREATE INDEX idx_user_groups_created_from_event ON user_groups(created_from_event_id);
CREATE INDEX idx_user_groups_active ON user_groups(is_active);
CREATE INDEX idx_user_groups_type ON user_groups(group_type);
```

#### `user_group_memberships` Table
```sql
CREATE TABLE user_group_memberships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(uid) ON DELETE CASCADE,
    added_by UUID REFERENCES user_profiles(uid) ON DELETE SET NULL,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    status membership_status_enum DEFAULT 'active',
    role group_member_role_enum DEFAULT 'member',
    
    -- User preferences
    email_notifications BOOLEAN DEFAULT true,
    joined_from_event_id UUID REFERENCES events(event_id) ON DELETE SET NULL,
    
    -- Constraints
    UNIQUE(group_id, user_id)
);

-- Create enums
CREATE TYPE membership_status_enum AS ENUM ('active', 'inactive', 'blocked');
CREATE TYPE group_member_role_enum AS ENUM ('member', 'admin');

-- Indexes
CREATE INDEX idx_user_group_memberships_group_id ON user_group_memberships(group_id);
CREATE INDEX idx_user_group_memberships_user_id ON user_group_memberships(user_id);
CREATE INDEX idx_user_group_memberships_status ON user_group_memberships(status);
```

#### `group_notifications` Table
```sql
CREATE TABLE group_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(event_id) ON DELETE CASCADE,
    sent_by UUID NOT NULL REFERENCES user_profiles(uid) ON DELETE CASCADE,
    
    -- Notification content
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    notification_type notification_type_enum DEFAULT 'event_announcement',
    
    -- Metadata
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    scheduled_for TIMESTAMPTZ,
    status notification_status_enum DEFAULT 'sent',
    
    -- Analytics
    total_recipients INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    clicked_count INTEGER DEFAULT 0,
    
    -- Additional data
    custom_data JSONB DEFAULT '{}'::jsonb
);

-- Create enums
CREATE TYPE notification_type_enum AS ENUM ('event_announcement', 'general_update', 'reminder');
CREATE TYPE notification_status_enum AS ENUM ('draft', 'scheduled', 'sent', 'failed');

-- Indexes
CREATE INDEX idx_group_notifications_group_id ON group_notifications(group_id);
CREATE INDEX idx_group_notifications_event_id ON group_notifications(event_id);
CREATE INDEX idx_group_notifications_sent_by ON group_notifications(sent_by);
CREATE INDEX idx_group_notifications_sent_at ON group_notifications(sent_at);
CREATE INDEX idx_group_notifications_status ON group_notifications(status);
```

#### `notification_recipients` Table
```sql
CREATE TABLE notification_recipients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    notification_id UUID NOT NULL REFERENCES group_notifications(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(uid) ON DELETE CASCADE,
    
    -- Delivery status
    status recipient_status_enum DEFAULT 'pending',
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    
    -- Error tracking
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Constraints
    UNIQUE(notification_id, user_id)
);

-- Create enum
CREATE TYPE recipient_status_enum AS ENUM ('pending', 'sent', 'delivered', 'failed', 'bounced');

-- Indexes
CREATE INDEX idx_notification_recipients_notification_id ON notification_recipients(notification_id);
CREATE INDEX idx_notification_recipients_user_id ON notification_recipients(user_id);
CREATE INDEX idx_notification_recipients_status ON notification_recipients(status);
```

### 2. Database Migration Files

Create the following migration files in `supabase/migrations/`:

1. `20250127_create_user_groups.sql` - Create user_groups table and enums
2. `20250127_create_user_group_memberships.sql` - Create memberships table
3. `20250127_create_group_notifications.sql` - Create notifications tables
4. `20250127_add_user_group_permissions.sql` - Add RLS policies

### 3. Row Level Security (RLS) Policies

```sql
-- User Groups policies
ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view groups they created or are members of" ON user_groups
    FOR SELECT USING (
        created_by = auth.uid() OR 
        id IN (
            SELECT group_id FROM user_group_memberships 
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "Users can create their own groups" ON user_groups
    FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update groups they created" ON user_groups
    FOR UPDATE USING (created_by = auth.uid());

-- Similar policies for other tables...
```

## API Endpoints

### 1. User Groups Management

#### `features/user-groups/api/groups/route.ts`
```typescript
// GET /api/user-groups/groups - List user's groups
// POST /api/user-groups/groups - Create new group
export async function GET() { /* ... */ }
export async function POST() { /* ... */ }
```

#### `features/user-groups/api/groups/[id]/route.ts`
```typescript
// GET /api/user-groups/groups/[id] - Get group details
// PUT /api/user-groups/groups/[id] - Update group
// DELETE /api/user-groups/groups/[id] - Delete group
```

#### `features/user-groups/api/groups/[id]/members/route.ts`
```typescript
// GET /api/user-groups/groups/[id]/members - List group members
// POST /api/user-groups/groups/[id]/members - Add members
// DELETE /api/user-groups/groups/[id]/members - Remove members
```

### 2. Event Integration

#### `features/user-groups/api/groups/create-from-event/route.ts`
```typescript
// POST /api/user-groups/groups/create-from-event
// Create group from event participants
export async function POST(request: Request) {
  const { eventId, groupName, description, filters } = await request.json();
  // Logic to create group from event participants
}
```

### 3. Notification System

#### `features/user-groups/api/notifications/route.ts`
```typescript
// POST /api/user-groups/notifications - Send notification to group
export async function POST(request: Request) {
  const { groupId, eventId, subject, message, scheduleFor } = await request.json();
  // Logic to send notifications
}
```

#### `features/user-groups/api/notifications/[id]/analytics/route.ts`
```typescript
// GET /api/user-groups/notifications/[id]/analytics - Get notification analytics
```

## Frontend Components

### 1. User Groups Feature Structure

```
features/user-groups/
├── components/
│   ├── groups/
│   │   ├── GroupsList.tsx
│   │   ├── GroupCard.tsx
│   │   ├── CreateGroupModal.tsx
│   │   ├── EditGroupModal.tsx
│   │   └── GroupDetails.tsx
│   ├── members/
│   │   ├── MembersList.tsx
│   │   ├── AddMembersModal.tsx
│   │   ├── MemberCard.tsx
│   │   └── BulkMemberActions.tsx
│   ├── notifications/
│   │   ├── NotificationComposer.tsx
│   │   ├── NotificationHistory.tsx
│   │   ├── NotificationAnalytics.tsx
│   │   └── ScheduleNotificationModal.tsx
│   └── event-integration/
│       ├── CreateGroupFromEvent.tsx
│       ├── EventParticipantSelector.tsx
│       └── ParticipantFilters.tsx
├── hooks/
│   ├── useUserGroups.ts
│   ├── useGroupMembers.ts
│   ├── useGroupNotifications.ts
│   └── useEventParticipants.ts
├── api/
│   └── [API files as listed above]
└── utils/
    ├── groupHelpers.ts
    ├── notificationHelpers.ts
    └── analytics.ts
```

### 2. Key Components

#### `GroupsList.tsx`
```typescript
export function GroupsList() {
  const { groups, isLoading } = useUserGroups();
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Your Groups</h2>
        <CreateGroupModal />
      </div>
      {groups.map(group => (
        <GroupCard key={group.id} group={group} />
      ))}
    </div>
  );
}
```

#### `NotificationComposer.tsx`
```typescript
interface NotificationComposerProps {
  groupId: string;
  eventId?: string;
}

export function NotificationComposer({ groupId, eventId }: NotificationComposerProps) {
  // Component for composing and sending notifications
}
```

### 3. Integration with Existing Components

#### Update Organizer Dashboard
Add new tab for User Groups in `features/user/dashboards/dashboard/organizer/index.tsx`:

```typescript
// Add new tab trigger
<TabsTrigger value="groups" className="flex items-center gap-2">
  <Users className="h-4 w-4" />
  Groups
</TabsTrigger>

// Add new tab content
<TabsContent value="groups">
  <UserGroupsTab eventId={eventId} />
</TabsContent>
```

#### Update Event Creation Flow
Add option to notify user groups when creating new events in event creation forms.

## Email Template Updates

### 1. New Email Templates

#### `lib/templates/group-notification.ts`
```typescript
export function getGroupNotificationEmailTemplate(
  subject: string,
  message: string,
  groupName: string,
  senderName: string,
  eventDetails?: EventDetails,
  unsubscribeUrl?: string
) {
  return {
    subject,
    html: `
      <!-- Email template for group notifications -->
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <h2>New message from ${groupName}</h2>
        <p><strong>From:</strong> ${senderName}</p>
        ${eventDetails ? `
          <div style="background: #f5f5f5; padding: 16px; margin: 16px 0; border-radius: 8px;">
            <h3>Event: ${eventDetails.event_name}</h3>
            <p><strong>Date:</strong> ${eventDetails.event_date}</p>
            <p><strong>Location:</strong> ${eventDetails.location}</p>
          </div>
        ` : ''}
        <div style="margin: 20px 0;">
          ${message.replace(/\n/g, '<br>')}
        </div>
        ${unsubscribeUrl ? `
          <p style="font-size: 12px; color: #666;">
            <a href="${unsubscribeUrl}">Unsubscribe from this group</a>
          </p>
        ` : ''}
      </div>
    `
  };
}
```

### 2. Update Existing Email Route

Update `app/api/email/route.ts` to handle group notifications:

```typescript
// Add new case for group notifications
else if (type === 'group_notification') {
  const { groupId, recipients, subject, message, senderName, eventDetails } = data;
  
  const template = getGroupNotificationEmailTemplate(
    subject, 
    message, 
    groupName, 
    senderName, 
    eventDetails
  );
  
  // Send to all recipients
  await Promise.all(
    recipients.map(email => 
      sendEmail(email, template.subject, template.html)
    )
  );
}
```

## Database Type Updates

### Update `lib/database.types.ts`

Add new types for the user groups tables:

```typescript
export interface Database {
  public: {
    Tables: {
      // ... existing tables
      user_groups: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_by: string;
          created_from_event_id: string | null;
          created_at: string;
          updated_at: string;
          is_active: boolean;
          group_type: 'manual' | 'event_based' | 'role_based';
          tags: Json;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          created_by: string;
          created_from_event_id?: string | null;
          created_at?: string;
          updated_at?: string;
          is_active?: boolean;
          group_type?: 'manual' | 'event_based' | 'role_based';
          tags?: Json;
        };
        Update: {
          // ... update type
        };
      };
      user_group_memberships: {
        // ... similar structure
      };
      group_notifications: {
        // ... similar structure
      };
      notification_recipients: {
        // ... similar structure
      };
    };
    Enums: {
      // ... existing enums
      group_type_enum: 'manual' | 'event_based' | 'role_based';
      membership_status_enum: 'active' | 'inactive' | 'blocked';
      group_member_role_enum: 'member' | 'admin';
      notification_type_enum: 'event_announcement' | 'general_update' | 'reminder';
      notification_status_enum: 'draft' | 'scheduled' | 'sent' | 'failed';
      recipient_status_enum: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
    };
  };
}
```

## UI/UX Considerations

### 1. Navigation Updates

Add "Groups" section to the main navigation for organizers:

```typescript
// Update navigation components to include groups link
{userRole === EventRole.Organizer && (
  <NavItem href="/groups" icon={Users}>
    Groups
  </NavItem>
)}
```

### 2. User Experience Flow

1. **Group Creation Flow**:
   - Organizer goes to past event
   - Clicks "Create Group from Event"
   - Selects participants based on filters (role, participation status, etc.)
   - Names and describes the group
   - Group is created with selected members

2. **Event Broadcasting Flow**:
   - Organizer creates new event
   - In event creation/editing, sees option "Notify Groups"
   - Selects which groups to notify
   - Customizes notification message
   - Sends notification to group members

3. **Member Management**:
   - View group members with their participation history
   - Add/remove members manually
   - Bulk actions for member management
   - Member preferences management

## Analytics and Reporting

### 1. Group Analytics Dashboard

Track key metrics:
- Group growth over time
- Notification engagement rates
- Event attendance correlation
- Member activity levels

### 2. Notification Analytics

For each notification sent:
- Delivery rates
- Open rates
- Click-through rates
- Response rates (event registrations)

## Implementation Timeline

### Phase 1: Database and Backend (Week 1-2)
- [ ] Create database migrations
- [ ] Set up RLS policies  
- [ ] Implement core API endpoints
- [ ] Update database types

### Phase 2: Core Components (Week 2-3)
- [ ] Build group management components
- [ ] Create member management interface
- [ ] Implement notification composer
- [ ] Add event integration components

### Phase 3: Integration and Polish (Week 3-4)
- [ ] Integrate with organizer dashboard
- [ ] Update email system
- [ ] Add analytics dashboard
- [ ] Implement user preferences

### Phase 4: Testing and Optimization (Week 4)
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] User acceptance testing
- [ ] Documentation updates

## Security Considerations

1. **Access Control**: Only group creators and admins can manage groups
2. **Privacy**: Users can opt out of groups and notifications
3. **Rate Limiting**: Prevent spam by limiting notification frequency
4. **Data Protection**: Ensure GDPR compliance for user data
5. **Email Validation**: Verify email addresses before sending notifications

## Monitoring and Maintenance

1. **Email Deliverability**: Monitor bounce rates and spam reports
2. **Database Performance**: Monitor query performance on new tables
3. **User Engagement**: Track group usage and notification effectiveness
4. **Error Handling**: Implement comprehensive error logging and alerting

## Success Metrics

1. **Adoption Rate**: Percentage of organizers creating groups
2. **Engagement Rate**: Average notification open/click rates
3. **Event Attendance**: Correlation between group notifications and event attendance
4. **User Satisfaction**: Feedback on group functionality
5. **Platform Growth**: Increase in repeat event participation

---

This implementation plan provides a comprehensive roadmap for adding user groups functionality to your event management platform. The feature will enable organizers to build lasting communities around their events and improve event promotion effectiveness.