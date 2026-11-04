import { EventRole } from "@/lib/types";
import {
  getEventNavigationTarget,
  getInternalEventHref,
  isEventManagerRole,
  canUseInternalEventRoute,
  isEventInviteAcceptancePath,
} from "./navigation";

describe("event navigation", () => {
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

  it("keeps judges on internal routes because scoring only exists there", () => {
    expect(canUseInternalEventRoute({ userRole: EventRole.Judge })).toBe(true);
    expect(isEventManagerRole(EventRole.Judge)).toBe(false);
  });

  it.each([EventRole.Participant, EventRole.Mentor, null, undefined])(
    "keeps sending %s out of internal routes",
    (userRole) => {
      expect(canUseInternalEventRoute({ userRole })).toBe(false);
    }
  );

  it.each([
    "/events/spring-showcase/accept",
    "/events/spring-showcase/accept-judge",
    "/events/spring-showcase/accept-organizer",
    "/events/spring-showcase/accept-participant",
    "/events/spring-showcase/accept-judge/",
  ])("recognizes %s as an invite acceptance route", (pathname) => {
    expect(isEventInviteAcceptancePath(pathname)).toBe(true);
  });

  it.each([
    "/events/spring-showcase",
    "/events/spring-showcase/overview",
    "/events/spring-showcase/tickets",
    "/events/spring-showcase/accepted",
    "/events/accept-judge",
    "/events/accept-judge/overview",
    "/events/spring-showcase/tools/accept-judge",
    "/accept-judge",
    "",
    null,
    undefined,
  ])("does not treat %s as an invite acceptance route", (pathname) => {
    expect(isEventInviteAcceptancePath(pathname)).toBe(false);
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

  it("keeps external events internal for judges", () => {
    expect(
      getEventNavigationTarget({
        event_id: "event-123",
        slug: "partner-event",
        external_url: "https://partner.example.com/hack",
        external_redirect_enabled: true,
        userRole: EventRole.Judge,
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
