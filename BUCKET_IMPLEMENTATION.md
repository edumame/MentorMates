# Event Buckets Implementation

## Overview

Event buckets provide a way to organize events into categorized containers with fine-grained access control. This implementation adds a hierarchical organization system on top of the existing event management platform.

## Database Schema

### Tables Created

#### `event_buckets`
- **bucket_id**: UUID primary key
- **bucket_name**: Display name for the bucket
- **bucket_description**: Optional description
- **bucket_slug**: Unique URL-friendly identifier
- **bucket_color**: Hex color code for visual identification
- **bucket_icon**: Optional emoji or icon
- **visibility**: Uses existing event_visibility enum (public, private, draft, demo, test)
- **created_by**: Reference to user who created the bucket
- **created_at/updated_at**: Timestamps

#### `bucket_permissions`
- **id**: UUID primary key
- **bucket_id**: Reference to event bucket
- **user_id**: Reference to user
- **permission**: Enum ('read', 'write', 'admin')
- **granted_by**: User who granted the permission
- **granted_at**: Timestamp

#### `events` (modified)
- **bucket_id**: Optional reference to event bucket

## Access Control

### Permission Levels
1. **Read**: Can view bucket and its events
2. **Write**: Can add/remove events from bucket
3. **Admin**: Full bucket management (edit, delete, manage permissions)

### Access Rules
1. **Bucket Creators**: Automatic admin access to their buckets
2. **Public Buckets**: Read access for all users
3. **Private Buckets**: Access only through explicit permissions
4. **Event Access**: Events inherit bucket access controls in addition to their own visibility rules

### Row Level Security (RLS)
- Comprehensive RLS policies protect all bucket operations
- Events visibility now considers both event-level and bucket-level permissions
- Function `check_bucket_access()` provides centralized permission checking

## API Endpoints

### Bucket Management
- `GET /api/buckets` - List accessible buckets
- `POST /api/buckets` - Create new bucket
- `GET /api/buckets/[bucketId]` - Get bucket details
- `PUT /api/buckets/[bucketId]` - Update bucket
- `DELETE /api/buckets/[bucketId]` - Delete bucket (if empty)

### Bucket Permissions
- `GET /api/buckets/[bucketId]/permissions` - List bucket permissions
- `POST /api/buckets/[bucketId]/permissions` - Grant permission
- `DELETE /api/buckets/[bucketId]/permissions?user_id=...` - Revoke permission

### Event Assignment
- `PUT /api/events/[eventId]/bucket` - Assign/remove event from bucket

## UI Components

### `BucketFilter`
- Dropdown filter for events page
- Shows bucket color, icon, and event count
- Filters events by selected bucket

### `BucketManagement`
- Admin/organizer interface for bucket CRUD operations
- Create, edit, delete buckets
- Visual bucket cards with metadata

### `EventBucketAssignment`
- Component for assigning events to buckets
- Shows current assignment
- Save/cancel functionality
- Permission-aware (read-only for non-organizers)

## Integration Points

### Events Page
- Added bucket filtering to events list
- Events display bucket badges with colors
- Updated search to work with bucket filtering

### Event Details
- Events show bucket information in cards
- Bucket assignment component for organizers/admins

### Types & Interfaces
- Added `EventBucket` interface
- Added `BucketPermissionItem` interface
- Added `BucketPermission` enum
- Updated `EventItem` to include bucket references

## Usage Examples

### Creating a Bucket
```typescript
const response = await fetch("/api/buckets", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    bucket_name: "Hackathons 2025",
    bucket_description: "All hackathon events for 2025",
    bucket_slug: "hackathons-2025",
    bucket_color: "#10B981",
    bucket_icon: "🏆",
    visibility: "public"
  })
});
```

### Assigning Event to Bucket
```typescript
const response = await fetch(`/api/events/${eventId}/bucket`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ bucket_id: bucketId })
});
```

### Granting Bucket Permission
```typescript
const response = await fetch(`/api/buckets/${bucketId}/permissions`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    user_id: userId,
    permission: "write"
  })
});
```

## Security Considerations

1. **RLS Enforcement**: All tables have comprehensive RLS policies
2. **Permission Validation**: API endpoints validate permissions before operations
3. **Cascade Deletes**: Proper foreign key constraints with appropriate cascade behavior
4. **Input Validation**: API endpoints validate required fields and data types

## Migration Notes

To apply the bucket implementation:
1. Run the migration: `20250128_create_event_buckets.sql`
2. The migration creates a default "General" bucket for existing events
3. Existing events remain accessible (bucket_id is nullable)
4. RLS policies are immediately active

## Future Enhancements

1. **Bulk Event Assignment**: UI for moving multiple events between buckets
2. **Bucket Templates**: Predefined bucket configurations
3. **Bucket Analytics**: Usage statistics and insights
4. **Bucket Sharing**: Direct sharing links for public buckets
5. **Bucket Notifications**: Alerts when events are added/removed