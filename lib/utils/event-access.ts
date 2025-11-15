import { EventVisibility, EventRole } from "@/lib/types";

/**
 * Determines if a user can access an event based on visibility and their role
 *
 * Visibility rules:
 * - Draft: Only organizers and admins
 * - Unlisted: Anyone with direct link (no listing)
 * - Private: Anyone with password (shown in listings)
 * - Public: Everyone (shown in listings)
 * - Archived: Anyone with direct link, read-only (no listing)
 */
export function canAccessEvent(
  visibility: EventVisibility,
  isAuthenticated: boolean,
  userRole: EventRole | null,
  isAdmin: boolean
): {
  canAccess: boolean;
  requiresPassword: boolean;
  reason?: string;
} {
  // Admins can always access
  if (isAdmin) {
    return { canAccess: true, requiresPassword: false };
  }

  switch (visibility) {
    case EventVisibility.Draft:
      // Only organizers and admins can access draft events
      if (userRole === EventRole.Organizer || userRole === EventRole.Admin) {
        return { canAccess: true, requiresPassword: false };
      }
      return {
        canAccess: false,
        requiresPassword: false,
        reason: "This event is still in draft mode and not yet public.",
      };

    case EventVisibility.Unlisted:
      // Anyone with the link can access (no password required)
      return { canAccess: true, requiresPassword: false };

    case EventVisibility.Private:
      // Organizers don't need password
      if (userRole === EventRole.Organizer) {
        return { canAccess: true, requiresPassword: false };
      }
      // Others need to be authenticated and will need to enter password when joining
      return {
        canAccess: isAuthenticated,
        requiresPassword: true,
        reason: isAuthenticated
          ? undefined
          : "You must be logged in to access this private event.",
      };

    case EventVisibility.Public:
      // Everyone can access
      return { canAccess: true, requiresPassword: false };

    case EventVisibility.Archived:
      // Anyone with the link can access (read-only)
      return { canAccess: true, requiresPassword: false };

    default:
      return {
        canAccess: false,
        requiresPassword: false,
        reason: "Invalid event visibility setting.",
      };
  }
}

/**
 * Determines if an event should appear in public listings/search
 */
export function isEventDiscoverable(
  visibility: EventVisibility,
  isAuthenticated: boolean,
  userRole: EventRole | null,
  isAdmin: boolean
): boolean {
  // Admins see all events in listings
  if (isAdmin) return true;

  switch (visibility) {
    case EventVisibility.Public:
      // Always discoverable
      return true;

    case EventVisibility.Private:
      // Shown to authenticated users
      // Organizers see their own private events
      return isAuthenticated;

    case EventVisibility.Draft:
      // Only organizers see their draft events
      return userRole === EventRole.Organizer;

    case EventVisibility.Unlisted:
    case EventVisibility.Archived:
      // Never in public listings (direct link only)
      // But organizers see their own
      return userRole === EventRole.Organizer;

    default:
      return false;
  }
}
