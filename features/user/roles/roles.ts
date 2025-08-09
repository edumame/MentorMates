import { EventRole } from "@/lib/types";

/**
 * Default role labels used when custom labels are not defined
 */
export const DEFAULT_ROLE_LABELS: Record<string, string> = {
  [EventRole.Participant]: "Participant",
  [EventRole.Mentor]: "Mentor",
  [EventRole.Judge]: "Judge",
  [EventRole.Organizer]: "Organizer",
  [EventRole.Admin]: "Admin",
};

/**
 * Get the display label for a role based on the event's custom configuration
 *
 * @param role The role enum value
 * @param eventRoleLabels The event's custom role labels (if any)
 * @returns The display label for the role
 */
export function getRoleLabel(
  role: EventRole | string,
  eventRoleLabels?: Record<string, string> | null
): string {
  // If we have custom labels for this event and this role has a custom label
  if (eventRoleLabels && eventRoleLabels[role]) {
    return eventRoleLabels[role];
  }

  // Fall back to default labels
  return (
    DEFAULT_ROLE_LABELS[role] ||
    role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()
  );
}

/**
 * Get the role key from a display label
 *
 * @param label The display label
 * @param eventRoleLabels The event's custom role labels (if any)
 * @returns The role key that matches the label
 */
export function getRoleFromLabel(
  label: string,
  eventRoleLabels?: Record<string, string> | null
): EventRole | null {
  // If we have custom labels, check if any match the given label
  if (eventRoleLabels) {
    for (const [role, roleLabel] of Object.entries(eventRoleLabels)) {
      if (roleLabel.toLowerCase() === label.toLowerCase()) {
        return role as EventRole;
      }
    }
  }

  // Check against default labels
  for (const [role, defaultLabel] of Object.entries(DEFAULT_ROLE_LABELS)) {
    if (defaultLabel.toLowerCase() === label.toLowerCase()) {
      return role as EventRole;
    }
  }

  return null;
}

/**
 * Check if a user role can access functionality of a target role
 * Higher numeric values can access lower-level functionality
 *
 * @param userRole The user's actual role
 * @param targetRole The role being accessed
 * @returns True if user can access the target role's functionality
 */
export function canAccessRole(userRole: EventRole, targetRole: EventRole): boolean {
  return userRole >= targetRole;
}

/**
 * Get all roles that a user can access based on their role level
 * Returns roles in ascending order (lowest permission first)
 *
 * @param userRole The user's actual role
 * @returns Array of roles the user can access
 */
export function getAccessibleRoles(userRole: EventRole): EventRole[] {
  const allRoles = Object.values(EventRole).filter(role => typeof role === 'number') as EventRole[];
  return allRoles
    .filter(role => userRole >= role)
    .sort((a, b) => a - b);
}

/**
 * Get all roles in the system ordered by hierarchy level
 *
 * @returns Array of all roles in ascending order
 */
export function getAllRoles(): EventRole[] {
  return Object.values(EventRole)
    .filter(role => typeof role === 'number')
    .sort((a, b) => (a as number) - (b as number)) as EventRole[];
}

/**
 * Check if a role is higher in hierarchy than another role
 *
 * @param role1 First role to compare
 * @param role2 Second role to compare
 * @returns True if role1 is higher than role2
 */
export function isHigherRole(role1: EventRole, role2: EventRole): boolean {
  return role1 > role2;
}

/**
 * Get the minimum role required to access a specific functionality
 * This is useful for defining access control requirements
 *
 * @param requiredRole The minimum role needed
 * @returns The numeric role value
 */
export function getMinimumRole(requiredRole: EventRole): EventRole {
  return requiredRole;
}
