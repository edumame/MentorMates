# Role System Migration: String-based to Numeric Hierarchy

## Overview

This document outlines the migration from the current string-based role system to a numeric hierarchy system that enables role-based access control through numeric comparisons and role switching functionality.

## New Role Hierarchy

```typescript
enum EventRole {
  Participant = 1,
  Mentor = 2,
  Judge = 3,
  Organizer = 4,
  Admin = 5  // Highest level access
}
```

### Role Access Rules
- Higher numbers can access all lower-level functionality
- Role 4 (Organizer) can view dashboards as Participant (1), Mentor (2), or Judge (3)
- Role 5 (Admin) can view dashboards as any lower role
- Access control uses `>=` comparisons instead of exact role matching

## Implementation Plan

### Phase 1: Database Schema Changes

#### 1.1 Update Database Enum
```sql
-- Create new numeric role type
CREATE TYPE event_role_numeric AS ENUM ('1', '2', '3', '4', '5');

-- Migration will convert existing string roles to numeric equivalents
```

#### 1.2 Role Mapping for Migration
- `participant` → `1`
- `mentor` → `2`
- `judge` → `3`
- `organizer` → `4`
- `admin` → `5`
- `event` → `4` (treat as organizer level)

### Phase 2: TypeScript Updates

#### 2.1 Core Type Definitions
```typescript
// lib/types/index.ts
export enum EventRole {
  Participant = 1,
  Mentor = 2,
  Judge = 3,
  Organizer = 4,
  Admin = 5
}

export type RoleHierarchy = {
  canAccess: (targetRole: EventRole) => boolean;
  getAccessibleRoles: () => EventRole[];
}
```

#### 2.2 Role Utility Functions
```typescript
// features/user/roles/role-hierarchy.ts
export const canAccessRole = (userRole: EventRole, targetRole: EventRole): boolean => {
  return userRole >= targetRole;
}

export const getAccessibleRoles = (userRole: EventRole): EventRole[] => {
  return Object.values(EventRole)
    .filter(role => typeof role === 'number' && userRole >= role)
    .sort((a, b) => a - b);
}

export const getRoleLabel = (role: EventRole): string => {
  const labels = {
    [EventRole.Participant]: 'Participant',
    [EventRole.Mentor]: 'Mentor',
    [EventRole.Judge]: 'Judge',
    [EventRole.Organizer]: 'Organizer',
    [EventRole.Admin]: 'Admin'
  };
  return labels[role] || 'Unknown';
}
```

### Phase 3: Role Switching System

#### 3.1 Role Context Extension
```typescript
// components/event-registration-provider.tsx
interface EventRegistrationContextType {
  // ... existing properties
  activeRole: EventRole; // Currently selected role for dashboard view
  actualRole: EventRole; // User's actual assigned role
  switchRole: (role: EventRole) => void;
  canSwitchToRole: (role: EventRole) => boolean;
}
```

#### 3.2 Role Switcher Component
```typescript
// components/role-switcher.tsx
interface RoleSwitcherProps {
  currentRole: EventRole;
  actualRole: EventRole;
  onRoleChange: (role: EventRole) => void;
}
```

### Phase 4: Database Migration Strategy

#### 4.1 Migration Steps
1. **Backup Current Data**: Create backup of `user_event_roles` and `role_passwords`
2. **Create New Columns**: Add temporary numeric role columns
3. **Data Conversion**: Convert existing string roles to numeric equivalents
4. **Update Constraints**: Add new constraints for numeric roles
5. **Switch Column Types**: Replace old enum with new numeric type
6. **Update Indexes**: Recreate indexes for new role structure

#### 4.2 Rollback Plan
- Keep backup tables with original string-based roles
- Migration script includes rollback functionality
- Database constraints ensure data integrity during migration

### Phase 5: API Updates

#### 5.1 Role Verification Endpoint
```typescript
// features/user/api/roles/verify/route.ts
// Update to handle numeric role comparisons
// Add role switching validation
```

#### 5.2 New Role Switching Endpoint
```typescript
// features/user/api/roles/switch/route.ts
// Validate user can switch to target role
// Update session context with new active role
```

### Phase 6: UI Component Updates

#### 6.1 Dashboard Routing
```typescript
// app/events/[id]/dashboard/page.tsx
// Use activeRole from context instead of actualRole
// Maintain role switching state across navigation
```

#### 6.2 Role-based Access Control
```typescript
// Update all components using role checks
// Replace string comparisons with numeric comparisons
// Use canAccessRole() utility function
```

## Migration Testing Strategy

### 6.1 Data Integrity Tests
- Verify all existing roles convert correctly
- Ensure no data loss during migration
- Validate role hierarchy constraints

### 6.2 Functionality Tests
- Test role switching for organizers/admins
- Verify dashboard access restrictions
- Validate role-based API endpoints

### 6.3 Performance Tests
- Compare query performance with numeric vs string roles
- Test dashboard loading with role switching
- Validate role hierarchy calculations

## Breaking Changes

### 6.1 API Response Changes
- Role fields will return numbers instead of strings
- Client applications may need updates

### 6.2 Database Schema Changes
- `event_role` enum type changes
- May affect external integrations

### 6.3 TypeScript Type Changes
- EventRole enum values change from strings to numbers
- Components using role comparisons need updates

## Post-Migration Cleanup

1. **Remove Legacy Code**: Clean up old string-based role handling
2. **Update Documentation**: Update all role-related documentation
3. **Monitor Performance**: Track query performance with new schema
4. **User Testing**: Validate role switching functionality with real users

## Implementation Timeline

- **Phase 1-2**: Database and TypeScript updates (2-3 days)
- **Phase 3**: Role switching system (2 days)
- **Phase 4**: Migration scripts and testing (1-2 days)
- **Phase 5-6**: API and UI updates (3-4 days)
- **Total Estimated Time**: 8-11 days

## Risk Mitigation

- **Database Backup**: Full backup before migration
- **Staged Rollout**: Test on staging environment first
- **Feature Flags**: Use feature flags for role switching
- **Monitoring**: Add logging for role operations
- **Rollback Plan**: Prepared rollback scripts for emergency reversion