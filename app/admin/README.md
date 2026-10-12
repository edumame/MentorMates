# Admin Event Management

This admin page allows administrators to manage which events are featured and approved for display on the platform.

## Features

- **Featured Events**: Mark events to be featured on the homepage
- **Approved Events**: Approve events for public display
- **Visual Management**: Uses EventCard component for easy visual identification
- **Real-time Updates**: Instant feedback when toggling featured/approved status

## Access Control

Only users with admin privileges can access this page. Admin status is verified using the `is_admin_user` RPC function in Supabase.

## Database Schema

The following fields have been added to the `events` table:

- `featured` (boolean): Whether the event is featured on the homepage
- `approved` (boolean): Whether the event has been approved by an admin

## API Endpoints

### PATCH `/api/admin/events/[eventId]`

Updates the featured and/or approved status of an event.

**Request Body:**
```json
{
  "featured": true,
  "approved": true
}
```

**Response:**
```json
{
  "success": true,
  "event": { ... }
}
```

## Usage

1. Navigate to `/admin` (requires admin authentication)
2. View all events in a grid layout with EventCard previews
3. Toggle the "Featured" checkbox to feature/unfeature events
4. Toggle the "Approved" checkbox to approve/unapprove events
5. Click "View Event" to see the event details page

## Migration

Run the migration file `20260101_add_featured_approved_to_events.sql` to add the required database columns.
