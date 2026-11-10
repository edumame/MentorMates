import { EventRole } from "@/lib/types";
import {
  getEventNavigationTarget,
  getInternalEventHref,
  isEventManagerRole,
  isInviteAcceptancePath,
  canUseInternalEventRoute,
  getExternalRedirectUrl,
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

  it("links external events out for non-manager roles when redirects are enabled", () => {
    expect(
      getEventNavigationTarget({
        event_id: "event-123",
        slug: "partner-event",
        external_url: " https://partner.example.com/hack ",
        external_redirect_enabled: true,
        approval_status: "approved",
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

  describe("getExternalRedirectUrl", () => {
    const base = { external_url: "https://partner.example.com/hack", external_redirect_enabled: true };

    it("redirects only admin-approved external events (allow-list)", () => {
      expect(getExternalRedirectUrl({ ...base, approval_status: "approved" })).toBe(base.external_url);
      expect(getExternalRedirectUrl({ ...base, approval_status: "not_submitted" })).toBeNull();
      expect(getExternalRedirectUrl({ ...base, approval_status: null })).toBeNull();
      expect(getExternalRedirectUrl({ ...base })).toBeNull();
    });

    it.each(["submitted", "rejected"])("never redirects %s (unreviewed) submissions", (approval_status) => {
      expect(getExternalRedirectUrl({ ...base, approval_status })).toBeNull();
      expect(
        getEventNavigationTarget({ event_id: "e", slug: "s", ...base, approval_status })
      ).toEqual({ href: "/events/s/overview", isExternal: false });
    });

    it.each(["javascript:alert(1)", "JAVASCRIPT:alert(1)", "data:text/html,x", "not a url", "  "])(
      "rejects non-http(s) external URL %p",
      (external_url) => {
        expect(getExternalRedirectUrl({ ...base, approval_status: "approved", external_url })).toBeNull();
      }
    );

    it("requires redirects to be enabled", () => {
      expect(getExternalRedirectUrl({ ...base, approval_status: "approved", external_redirect_enabled: false })).toBeNull();
    });
  });
});
