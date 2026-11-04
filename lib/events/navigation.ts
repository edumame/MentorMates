import { ApprovalStatus, EventRole, EventVisibility } from "@/lib/types";

export type EventNavigationRole = EventRole | string | null | undefined;

export type EventNavigationItem = {
  event_id: string;
  slug?: string | null;
  external_url?: string | null;
  external_redirect_enabled?: boolean | null;
  userRole?: EventNavigationRole;
  canManageEvent?: boolean | null;
};

export type EventReviewState = {
  visibility?: string | null;
  approval_status?: string | null;
};

// Private events go live before review, so only public events are gated here.
export function isUnapprovedPublicEvent({ visibility, approval_status }: EventReviewState) {
  return visibility === EventVisibility.Public && approval_status !== ApprovalStatus.Approved;
}

// Awaiting review or turned down. Public events that never entered review
// (not_submitted) stay reachable by direct link.
export function isPublicEventHiddenByReview(event: EventReviewState) {
  return (
    isUnapprovedPublicEvent(event) &&
    (event.approval_status === ApprovalStatus.Submitted ||
      event.approval_status === ApprovalStatus.Rejected)
  );
}

export function isEventManagerRole(role: EventNavigationRole) {
  return role === EventRole.Organizer || role === EventRole.Admin;
}

export function canUseInternalEventRoute({
  userRole,
  canManageEvent,
}: Pick<EventNavigationItem, "userRole" | "canManageEvent">) {
  return Boolean(canManageEvent) || isEventManagerRole(userRole);
}

export function getInternalEventHref(event: Pick<EventNavigationItem, "event_id" | "slug">) {
  return `/events/${event.slug || event.event_id}/overview`;
}

export function getEventNavigationTarget(event: EventNavigationItem) {
  const externalUrl = event.external_url?.trim();
  const externalRedirectEnabled = event.external_redirect_enabled === true;
  const internalHref = getInternalEventHref(event);

  if (externalUrl && externalRedirectEnabled && !canUseInternalEventRoute(event)) {
    return { href: externalUrl, isExternal: true };
  }

  return { href: internalHref, isExternal: false };
}
