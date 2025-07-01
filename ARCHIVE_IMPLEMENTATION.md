# Event Archiving Implementation

## Overview
This implementation adds comprehensive event archiving functionality to the platform, allowing organizers and admins to archive completed events with read-only state visibility.

## Features Implemented

### 1. Database Changes
- **Migration**: Added "archived" to the `event_visibility` enum
- **File**: `supabase/migrations/20250125_add_archived_visibility.sql`
- **Purpose**: Extends the existing visibility system to support archived events

### 2. Type System Updates
- **Updated**: `lib/types/index.ts` - Added `Archived = "archived"` to `EventVisibility` enum
- **Updated**: `lib/database.types.ts` - Added "archived" to the database type definitions
- **Purpose**: Ensures type safety across the application

### 3. API Endpoints

#### Archive/Unarchive API
- **File**: `app/api/events/[id]/archive/route.ts`
- **Method**: PATCH
- **Actions**: `archive` | `unarchive`
- **Permissions**: Only organizers and admins can archive/unarchive events
- **Functionality**: 
  - Archives events by setting visibility to "archived"
  - Unarchives events by restoring to "public" visibility
  - Includes proper permission checks and error handling

#### Archived Events API
- **File**: `app/api/events/archived/route.ts`
- **Method**: GET
- **Purpose**: Fetches archived events for authorized users
- **Permissions**: Only organizers (for their events) and admins (for all events)

### 4. Frontend Components

#### Archive Button Component
- **File**: `components/events/archive-event-button.tsx`
- **Features**:
  - Confirmation dialog before archiving/unarchiving
  - Loading states and error handling
  - Visual feedback with toast notifications
  - Different styling for archive vs unarchive actions

#### Custom Hook
- **File**: `lib/hooks/use-archive-event.ts`
- **Purpose**: Handles archive/unarchive API calls with proper error handling
- **Returns**: Loading state, error state, and action functions

#### Archived Events Page
- **File**: `app/events/archived/page.tsx`
- **Purpose**: Server-side page for viewing archived events
- **Permissions**: Redirects unauthorized users
- **Features**: Fetches and displays archived events with proper role-based access

#### Archived Events Client Component
- **File**: `components/events/archived-events-client.tsx`
- **Features**:
  - Grid layout for archived events
  - Visual indicators (orange theme) for archived status
  - Unarchive functionality for authorized users
  - Empty state with navigation back to active events

### 5. Dashboard Integration

#### Event Management Tab
- **File**: `features/user/dashboards/dashboard/organizer/access/EventManagementTab.tsx`
- **Location**: Organizer Dashboard → Access → Management
- **Features**:
  - Visual event status display
  - Archive/unarchive functionality
  - Event information summary
  - Real-time status updates

#### Access Tab Updates
- **File**: `features/user/dashboards/dashboard/organizer/access/index.tsx`
- **Changes**: Added "Management" tab with archive functionality

### 6. Event Filtering Updates

#### Main Events Page
- **Files**: `app/events/page.tsx`, `app/api/events/route.ts`
- **Changes**: Excluded archived events from main event listings
- **Added**: Link to view archived events for authorized users

#### Event Visibility Logic
- **Purpose**: Ensures archived events don't appear in regular event lists
- **Implementation**: Modified all event queries to exclude archived events

## User Experience

### For Organizers
1. **Archive Events**: Access through Organizer Dashboard → Access → Management
2. **View Archived Events**: Link appears on main events page when authorized
3. **Unarchive Events**: Available from both the archived events page and dashboard
4. **Visual Feedback**: Clear status indicators and confirmation dialogs

### For Admins
- Same functionality as organizers but with access to all events
- Can view and manage any archived event

### For Regular Users
- Archived events are completely hidden from view
- No access to archived events functionality
- Clean, uncluttered event listings

## Technical Details

### Permission System
- **Archive Permission**: Organizers (own events) + Admins (all events)
- **View Archived**: Organizers (own events) + Admins (all events)
- **API Security**: All endpoints validate user permissions

### Data Integrity
- **Read-Only State**: Archived events maintain all data but are hidden from main flows
- **Reversible**: Events can be unarchived to restore full functionality
- **Audit Trail**: Archive status is tracked through visibility field

### UI/UX Considerations
- **Visual Distinction**: Orange theme for archived events
- **Clear Labeling**: "Archived" badges and status indicators
- **Confirmation Dialogs**: Prevent accidental archiving
- **Toast Notifications**: Immediate feedback for actions

## Routes Added
- `/events/archived` - View archived events (authorized users only)
- `/api/events/[id]/archive` - Archive/unarchive endpoint
- `/api/events/archived` - Fetch archived events endpoint

## Database Migration Required
Run the migration to add "archived" to the event_visibility enum:
```sql
ALTER TYPE event_visibility ADD VALUE 'archived';
```

## Testing Recommendations
1. Test archive/unarchive functionality with different user roles
2. Verify permission checks work correctly
3. Test that archived events don't appear in main listings
4. Verify unarchive restores events to proper visibility
5. Test edge cases (non-existent events, unauthorized access)

## Future Enhancements
- Bulk archive operations
- Archive date tracking
- Automatic archiving based on event end date
- Archive analytics and reporting
- Export archived event data