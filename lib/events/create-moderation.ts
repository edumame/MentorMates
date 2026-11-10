import { ApprovalStatus, EventVisibility } from "@/lib/types";

/**
 * Moderation fields for a newly created event (ORG-002 round 2).
 *
 * Only admins may create an event that is already public, approved or
 * featured. Everyone else gets draft or private (unlisted) with
 * approval_status=not_submitted, whatever the client sent; listing publicly
 * goes through POST /api/events/request-approval and admin review. A "public"
 * request from a non-admin becomes private so the event is still usable.
 */
export function resolveCreateModeration({
  isAdmin,
  visibility,
  approvalStatus,
  featured,
}: {
  isAdmin: boolean;
  visibility?: EventVisibility | null;
  approvalStatus?: ApprovalStatus | null;
  featured?: boolean | null;
}) {
  const requested = visibility ?? EventVisibility.Draft;
  if (isAdmin) {
    return {
      visibility: requested,
      approval_status: approvalStatus ?? ApprovalStatus.NotSubmitted,
      featured: featured ?? false,
      publicRequestDeferred: false,
    };
  }
  const allowed = requested === EventVisibility.Draft || requested === EventVisibility.Private;
  return {
    visibility: allowed ? requested : EventVisibility.Private,
    approval_status: ApprovalStatus.NotSubmitted,
    featured: false,
    publicRequestDeferred: requested === EventVisibility.Public,
  };
}
