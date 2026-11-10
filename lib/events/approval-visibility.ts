import { ApprovalStatus, EventVisibility } from "@/lib/types";

/** Visibilities an organizer picks to take an event out of circulation. */
export function isWithdrawnVisibility(
  visibility: string | null | undefined,
): boolean {
  return (
    visibility === EventVisibility.Archived ||
    visibility === EventVisibility.Draft
  );
}

/**
 * Update fields that clear a pending submission when an event moves to a
 * withdrawn visibility, so the stale request leaves the admin Submitted queue.
 * Approved and rejected decisions are history and are left alone.
 */
export function withdrawSubmissionUpdate(
  approvalStatus: string | null | undefined,
  nextVisibility: EventVisibility,
): { approval_status?: ApprovalStatus.NotSubmitted } {
  return approvalStatus === ApprovalStatus.Submitted &&
    isWithdrawnVisibility(nextVisibility)
    ? { approval_status: ApprovalStatus.NotSubmitted }
    : {};
}
