import { EventRole } from "@/lib/types";

export type EventNavigationRole = EventRole | string | null | undefined;

export type EventNavigationItem = {
  event_id: string;
  slug?: string | null;
  external_url?: string | null;
  external_redirect_enabled?: boolean | null;
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
