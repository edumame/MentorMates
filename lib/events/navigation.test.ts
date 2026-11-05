import { EventRole } from "@/lib/types";
import {
  getEventNavigationTarget,
  getInternalEventHref,
  isEventManagerRole,
  isInviteAcceptancePath,
  canUseInternalEventRoute,
} from "./navigation";

describe("event navigation", () => {
  it.each([
    "/events/old-slug/accept-judge",
    "/events/old-slug/accept-participant",
    "/events/old-slug/accept-organizer/",
  ])("recognizes the invite acceptance route %s", (path) => {
    expect(isInviteAcceptancePath(path)).toBe(true);
  });

  it.each([
    null,
    "/events/old-slug",
    "/events/old-slug/overview",
    "/events/old-slug/accept",
    "/events/old-slug/accept-judge/extra",
    "/events/accept-judge",
  ])("does not treat %s as an invite acceptance route", (path) => {
    expect(isInviteAcceptancePath(path)).toBe(false);
  });

  it("uses the overview route as the internal event URL", () => {
    expect(
      getInternalEventHref({ event_id: "event-123", slug: "spring-showcase" })
    ).toBe("/events/spring-showcase/overview");
    expect(getInternalEventHref({ event_id: "event-123" })).toBe(
      "/events/event-123/overview"
    );
  });

  it("treats organizers and admins as event managers", () => {
    expect(isEventManagerRole(EventRole.Organizer)).toBe(true);
    expect(isEventManagerRole(EventRole.Admin)).toBe(true);
    expect(isEventManagerRole(EventRole.Participant)).toBe(false);
    expect(isEventManagerRole(null)).toBe(false);
  });

  it("allows internal event routes through an explicit manage flag", () => {
    expect(
      canUseInternalEventRoute({
        userRole: EventRole.Participant,
        canManageEvent: true,
      })
    ).toBe(true);
  });

  it("links external events out for non-manager roles when redirects are enabled", () => {
    expect(
      getEventNavigationTarget({
        event_id: "event-123",
        slug: "partner-event",
        external_url: " https://partner.example.com/hack ",
        external_redirect_enabled: true,
        userRole: EventRole.Participant,
      })
    ).toEqual({
      href: "https://partner.example.com/hack",
      isExternal: true,
    });
  });

  it("keeps external events internal by default", () => {
    expect(
      getEventNavigationTarget({
        event_id: "event-123",
        slug: "partner-event",
        external_url: "https://partner.example.com/hack",
        userRole: EventRole.Participant,
      })
    ).toEqual({
      href: "/events/partner-event/overview",
      isExternal: false,
    });
  });

  it("keeps external events internal when redirects are disabled", () => {
    expect(
      getEventNavigationTarget({
        event_id: "event-123",
        slug: "partner-event",
        external_url: "https://partner.example.com/hack",
        external_redirect_enabled: false,
        userRole: EventRole.Participant,
      })
    ).toEqual({
      href: "/events/partner-event/overview",
      isExternal: false,
    });
  });

  it("keeps external events internal for organizers", () => {
    expect(
      getEventNavigationTarget({
        event_id: "event-123",
        slug: "partner-event",
        external_url: "https://partner.example.com/hack",
        userRole: EventRole.Organizer,
      })
    ).toEqual({
      href: "/events/partner-event/overview",
      isExternal: false,
    });
  });

  it("keeps external events internal when management access is explicit", () => {
    expect(
      getEventNavigationTarget({
        event_id: "event-123",
        slug: "partner-event",
        external_url: "https://partner.example.com/hack",
        userRole: null,
        canManageEvent: true,
      })
    ).toEqual({
      href: "/events/partner-event/overview",
      isExternal: false,
    });
  });
});
