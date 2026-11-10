import { EventRole } from "@/lib/types";
import { isApprovedApprovalStatus, safeExternalHref } from "./approval";

export type EventNavigationRole = EventRole | string | null | undefined;

export type EventNavigationItem = {
  event_id: string;
  slug?: string | null;
  external_url?: string | null;
  external_redirect_enabled?: boolean | null;
  approval_status?: string | null;
  userRole?: EventNavigationRole;
  canManageEvent?: boolean | null;
};

export function isEventManagerRole(role: EventNavigationRole) {
  return role === EventRole.Organizer || role === EventRole.Admin;
}

export function canUseInternalEventRoute({
  userRole,
  canManageEvent,
}: Pick<EventNavigationItem, "userRole" | "canManageEvent">) {
  // Judges score from the internal event page, which has no external equivalent.
  return (
    Boolean(canManageEvent) ||
    isEventManagerRole(userRole) ||
    userRole === EventRole.Judge
  );
}

export function getInternalEventHref(event: Pick<EventNavigationItem, "event_id" | "slug">) {
  return `/events/${event.slug || event.event_id}/overview`;
}

/**
 * The external URL visitors should be redirected to, or null when the event
 * should stay on its internal page. Allow-list: only http(s) URLs of events an
 * admin approved (anyone can create an unreviewed event; PUB-001).
 */
export function getExternalRedirectUrl(
  event: Pick<EventNavigationItem, "external_url" | "external_redirect_enabled" | "approval_status">
) {
  if (event.external_redirect_enabled !== true) return null;
  if (!isApprovedApprovalStatus(event.approval_status)) return null;
  return safeExternalHref(event.external_url) ?? null;
}

export function getEventNavigationTarget(event: EventNavigationItem) {
  const externalUrl = getExternalRedirectUrl(event);
  const internalHref = getInternalEventHref(event);

  if (externalUrl && !canUseInternalEventRoute(event)) {
    return { href: externalUrl, isExternal: true };
  }

  return { href: internalHref, isExternal: false };
}
