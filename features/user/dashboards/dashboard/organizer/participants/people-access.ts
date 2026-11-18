import { EventRole } from "@/lib/types";

/**
 * Row-level controls for the People tab, mirroring the server rules in
 * app/api/events/[eventId]/participants/[userId]/route.ts and the
 * user_event_roles RLS policies (202611080203_a2_event_role_integrity.sql):
 * - nobody edits their own row (except admins);
 * - only admins edit organizer/admin rows or grant the organizer role;
 * - rows synthesized from project emails have no membership to edit.
 */
export interface PeopleViewer {
  currentUserId: string | null;
  isAdmin: boolean;
}

export interface PeopleRow {
  user_id: string;
  role: EventRole;
}

export function isProjectOnlyRow(row: PeopleRow): boolean {
  return row.user_id.startsWith("project-");
}

export type RowLockReason = "project" | "self" | "staff" | null;

export function getRowLockReason(row: PeopleRow, viewer: PeopleViewer): RowLockReason {
  if (isProjectOnlyRow(row)) return "project";
  if (viewer.isAdmin) return null;
  if (viewer.currentUserId && row.user_id === viewer.currentUserId) return "self";
  if (row.role === EventRole.Organizer || row.role === EventRole.Admin) return "staff";
  return null;
}

export function getRowLockMessage(reason: RowLockReason): string | null {
  switch (reason) {
    case "self":
      return "You can't change your own role. Ask another organizer or an admin.";
    case "staff":
      return "Only admins can change or remove organizers.";
    default:
      return null;
  }
}

/** Role options offered in the role dropdown for an editable row. */
export function getAssignableRoles(viewer: PeopleViewer): EventRole[] {
  const roles = [EventRole.Participant, EventRole.Mentor, EventRole.Judge];
  return viewer.isAdmin ? [...roles, EventRole.Organizer] : roles;
}

const MENTOR_ASSIGNMENTS_REMOVED =
  "Their mentoring assignments are removed. They come back if this person is made a mentor again.";

function describeJudgeScores(judgeScoreCount: number | null): string {
  if (judgeScoreCount === null) {
    return "Scores they already submitted are kept for organizers.";
  }
  const noun = judgeScoreCount === 1 ? "score" : "scores";
  return `This judge has submitted ${judgeScoreCount} ${noun}; they are kept for organizers but the person can no longer edit them.`;
}

/** Explains what removing a member does (shown in the confirmation dialog). */
export function describeRemoval(row: PeopleRow, judgeScoreCount: number | null = null): string[] {
  const lines = [
    "Their role in this event is removed and they lose access to member-only pages.",
    "They are removed from any team in this event.",
    "If they were approved through an approval request, it is closed, so they need a new approval to rejoin.",
  ];
  if (row.role === EventRole.Judge) {
    lines.push("Their judging assignments are removed.", describeJudgeScores(judgeScoreCount));
  }
  if (row.role === EventRole.Mentor) {
    lines.push(MENTOR_ASSIGNMENTS_REMOVED);
  }
  return lines;
}

/**
 * Explains the effect of changing a judge or mentor to another role. Their
 * project assignments are soft-revoked by the database and come back if they
 * get the role again (202611080105 for judges, 202611110201 for mentors).
 */
export function describeRoleChange(
  row: PeopleRow,
  newRole: EventRole,
  judgeScoreCount: number | null = null
): string[] | null {
  if (newRole === row.role) return null;
  if (row.role === EventRole.Judge) {
    return ["Their judging assignments are removed.", describeJudgeScores(judgeScoreCount)];
  }
  if (row.role === EventRole.Mentor) {
    return [MENTOR_ASSIGNMENTS_REMOVED];
  }
  return null;
}
