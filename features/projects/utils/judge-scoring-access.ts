import { EventRole } from "@/lib/types";
import { canAccessRole } from "@/features/user/roles/roles";

/**
 * Whether the project page should show the scoring form. Mirrors the A1
 * server rule (can_write_project_score): organizers/admins may score as
 * themselves; a judge needs an active (non-revoked) judge assignment for this
 * project. Unassigned judges would only get a 403 on save.
 */
export function canShowProjectScoring(
  role: EventRole | null | undefined,
  hasActiveJudgeAssignment: boolean
): boolean {
  if (!role || !canAccessRole(role, EventRole.Judge)) return false;
  if (canAccessRole(role, EventRole.Organizer)) return true;
  return hasActiveJudgeAssignment;
}
