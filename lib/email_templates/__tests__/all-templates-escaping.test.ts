/**
 * Table-driven: every template that interpolates user-controlled strings must
 * not let raw markup through (ORG-019 / PUB-004 / ORG-012 round 2).
 */
import { getOrganizerInvitationEmailTemplate } from "../organizer-invitation";
import { getEventRoleInvitationEmailTemplate } from "../event-role-invitation";
import { getProjectInvitationEmailTemplate } from "../project-invitation";
import { getClaimTicketEmailTemplate } from "../claim-ticket";
import { getGuestInvitationEmailTemplate } from "../guest-invitation";
import { getOrganizerCustomEmailTemplate } from "../organizer-custom";
import { getEventApprovalRequestEmailTemplate } from "../event-approval-request";
import { getGuideFreeAccessEmailTemplate } from "../guide-free-access";
import { getBrandedBroadcastEmail } from "../branded-broadcast";
import { getWelcomeProfileEmailTemplate } from "../welcome-profile";
import {
  getEventMemberRemovedNotificationEmail,
  getEventRoleChangedNotificationEmail,
  getEventScheduleUpdateNotificationEmail,
  getEventUpdateNotificationEmail,
} from "../event-notifications";
import { escapeUrl } from "../escape-html";
import type { EventDetails } from "@/lib/types";

const X = '<a href="https://phish.example.test">x</a>';
const URL_X = 'javascript:alert(1)';

const cases: Array<[string, () => { subject: string; html: string }]> = [
  ["organizer-invitation", () => getOrganizerInvitationEmailTemplate(X, "e1", X, true, "https://mentormates.ai/a?x=1&y=2", "https://mentormates.ai/e")],
  ["event-role-invitation", () => getEventRoleInvitationEmailTemplate({ eventName: X, inviterName: X, role: "judge", actionUrl: URL_X, eventUrl: "https://mentormates.ai/e" })],
  ["project-invitation", () => getProjectInvitationEmailTemplate(X, "p1", X, X, "tok")],
  ["claim-ticket", () => getClaimTicketEmailTemplate(X, "t1", X)],
  ["guest-invitation", () => getGuestInvitationEmailTemplate(X, "e1", X, { dayTitle: X, eventName: X, time: X })],
  ["organizer-custom", () => getOrganizerCustomEmailTemplate(X, `${X}\nline2`)],
  ["event-approval-request", () => getEventApprovalRequestEmailTemplate({ eventName: X, organizerName: X, organizerEmail: X, eventDate: X, location: X, eventId: "e1" })],
  ["guide-free-access", () => getGuideFreeAccessEmailTemplate({ email: X, linkedinUrl: URL_X })],
  ["branded-broadcast", () => getBrandedBroadcastEmail("s", X, { recipientName: X, signOff: X, cta: { label: X, url: URL_X }, promoCode: X })],
  ["welcome-profile", () => getWelcomeProfileEmailTemplate(X, "https://mentormates.ai/p")],
  ["event-update", () => getEventUpdateNotificationEmail(X, "e1", {} as EventDetails)],
  ["schedule-update", () => getEventScheduleUpdateNotificationEmail(X, "e1", { event_schedule: [{ time: X, events: [{ name: X, time: X }] }] } as unknown as EventDetails)],
  ["role-changed", () => getEventRoleChangedNotificationEmail(X, "e1", {} as EventDetails, X)],
  ["member-removed", () => getEventMemberRemovedNotificationEmail(X)],
];

describe.each(cases)("%s template", (_name, render) => {
  it("never contains raw attacker markup or javascript: links", () => {
    const { subject, html } = render();
    expect(html).not.toContain('<a href="https://phish.example.test"');
    expect(html).not.toMatch(/href="javascript:/i);
    expect(subject).not.toMatch(/[\r\n]/);
  });
});

describe("escapeUrl", () => {
  it("keeps http(s) query strings and blocks other schemes", () => {
    expect(escapeUrl("https://a.test/x?y=1&z=2")).toBe("https://a.test/x?y=1&z=2");
    expect(escapeUrl('https://a.test/"><script>')).not.toMatch(/["<>]/);
    expect(escapeUrl("javascript:alert(1)")).toBe("#");
    expect(escapeUrl("not a url")).toBe("#");
  });
});

describe("organizer invitation copy", () => {
  it("no longer claims access was already granted", () => {
    const { html } = getOrganizerInvitationEmailTemplate("E", "e1", "I", false, "https://mentormates.ai/a");
    expect(html).not.toMatch(/already been activated/);
    expect(html).toMatch(/starts once you accept/);
  });
});
