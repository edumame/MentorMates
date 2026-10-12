import { EventRole, EventRoleEnum } from "@/lib/types";

export const eventRoleMapping: Record<EventRole, EventRoleEnum> = {
  [EventRole.Participant]: EventRoleEnum.Participant,
  [EventRole.Mentor]: EventRoleEnum.Mentor,
  [EventRole.Judge]: EventRoleEnum.Judge,
  [EventRole.Organizer]: EventRoleEnum.Organizer,
  [EventRole.Admin]: EventRoleEnum.Admin,
};

export const eventRoleEnumMapping: Record<EventRoleEnum, EventRole> = {
  [EventRoleEnum.Participant]: EventRole.Participant,
  [EventRoleEnum.Mentor]: EventRole.Mentor,
  [EventRoleEnum.Judge]: EventRole.Judge,
  [EventRoleEnum.Organizer]: EventRole.Organizer,
  [EventRoleEnum.Admin]: EventRole.Admin,
};

export const roleBadgeVariants = {
  [EventRole.Participant]:
    "border-transparent bg-blue-400 text-white hover:bg-blue-500",
  [EventRole.Mentor]:
    "border-transparent bg-green-500 text-white hover:bg-green-600",
  [EventRole.Judge]:
    "border-transparent bg-purple-500 text-white hover:bg-purple-600",
  [EventRole.Organizer]:
    "border-transparent bg-amber-500 text-white hover:bg-amber-600",
  [EventRole.Admin]:
    "border-transparent bg-red-500 text-white hover:bg-red-600",
};

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
  const roleKey = role.toString();

  // If we have custom labels for this event and this role has a custom label
  if (eventRoleLabels && eventRoleLabels[roleKey]) {
    return eventRoleLabels[roleKey];
  }

  // Fall back to default labels
  return DEFAULT_ROLE_LABELS[roleKey] || "Unknown Role";
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
): EventRoleEnum | null {
  // If we have custom labels, check if any match the given label
  if (eventRoleLabels) {
    for (const [role, roleLabel] of Object.entries(eventRoleLabels)) {
      if (roleLabel.toLowerCase() === label.toLowerCase()) {
        return parseInt(role) as EventRoleEnum;
      }
    }
  }

  // Check against default labels
  for (const [role, defaultLabel] of Object.entries(DEFAULT_ROLE_LABELS)) {
    if (defaultLabel.toLowerCase() === label.toLowerCase()) {
      return parseInt(role) as EventRoleEnum;
    }
  }

  return null;
}

/**
 * Normalize role values that might come from the database as strings
 * (e.g. "judge", "organizer", or numeric strings like "3") to the
 * numeric EventRole enum used in the app.
 */
export function toEventRole(role: EventRole | string): EventRoleEnum {
  if (typeof role === "number") return role as EventRoleEnum;

  const key = role.toString().toLowerCase();
  const mapping: Record<string, EventRoleEnum> = {
    participant: EventRoleEnum.Participant,
    mentor: EventRoleEnum.Mentor,
    judge: EventRoleEnum.Judge,
    organizer: EventRoleEnum.Organizer,
    admin: EventRoleEnum.Admin,
    "1": EventRoleEnum.Mentor,
    "2": EventRoleEnum.Participant,
    "3": EventRoleEnum.Judge,
    "4": EventRoleEnum.Organizer,
    "5": EventRoleEnum.Admin,
  };

  return mapping[key] ?? EventRoleEnum.Participant;
}

/**
 * Check if a user role can access functionality of a target role
 * Higher numeric values can access lower-level functionality
 *
 * @param userRole The user's actual role
 * @param targetRole The role being accessed
 * @returns True if user can access the target role's functionality
 */
export function canAccessRole(
  userRole: EventRole,
  targetRole: EventRole
): boolean {
  return eventRoleMapping[userRole] >= eventRoleMapping[targetRole];
}

/**
 * Get all roles that a user can access based on their role level
 * Returns roles in ascending order (lowest permission first)
 *
 * @param userRole The user's actual role
 * @returns Array of roles the user can access
 */
export function getAccessibleRoles(userRole: EventRole): EventRole[] {
  const allRoles = Object.values(EventRoleEnum).filter(
    (role) => typeof role === "number"
  ) as EventRoleEnum[];
  return allRoles
    .filter((role) => eventRoleMapping[userRole] >= role)
    .sort((a, b) => a - b)
    .map((roleEnum) => eventRoleEnumMapping[roleEnum]);
}

/**
 * Get all roles in the system ordered by hierarchy level
 *
 * @returns Array of all roles in ascending order
 */
export function getAllRoles(): EventRole[] {
  return Object.values(EventRoleEnum)
    .filter((role) => typeof role === "number")
    .sort((a, b) => (a as number) - (b as number))
    .map((roleEnum) => eventRoleEnumMapping[roleEnum as EventRoleEnum]);
}

/**
 * Check if a role is higher in hierarchy than another role
 *
 * @param role1 First role to compare
 * @param role2 Second role to compare
 * @returns True if role1 is higher than role2
 */
export function isHigherRole(role1: EventRole, role2: EventRole): boolean {
  return eventRoleMapping[role1] > eventRoleMapping[role2];
}

/**
 * Check if a role is higher than or equal to another role
 *
 * @param role1 First role to compare
 * @param role2 Second role to compare
 * @returns True if role1 is higher than role2
 */
export function isHigherOrEqualRole(
  role1: EventRole,
  role2: EventRole
): boolean {
  return eventRoleMapping[role1] >= eventRoleMapping[role2];
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
