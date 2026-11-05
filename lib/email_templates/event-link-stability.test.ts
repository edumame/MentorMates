import type { EventDetails } from "../types";
import {
  getEventScheduleUpdateNotificationEmail,
  getEventUpdateNotificationEmail,
} from "./event-notifications";
import { getGuestInvitationEmailTemplate } from "./guest-invitation";
import { getOrganizerInvitationEmailTemplate } from "./organizer-invitation";

// Emails outlive a slug rename, so they must link by the immutable event id.
describe("event links in emails", () => {
  const eventInformation = {
    slug: "old-slug",
    event_schedule: [],
  } as unknown as EventDetails;

  it("links existing organizers to the event id", () => {
    const { html } = getOrganizerInvitationEmailTemplate(
      "Hack Night",
      "event-123",
      "Casey"
    );

    expect(html).toContain("/events/event-123/overview");
    expect(html).not.toContain("old-slug");
  });

  it("links guests to the event id", () => {
    const { html } = getGuestInvitationEmailTemplate(
      "Hack Night",
      "event-123",
      "Casey"
    );

    expect(html).toContain("https://mentormates.ai/events/event-123");
  });

  it("links event update notifications to the event id", () => {
    const { html } = getEventUpdateNotificationEmail("Hack Night", "event-123");

    expect(html).toContain("/events/event-123/overview");
  });

  it("links event schedule notifications to the event id", () => {
    const { html } = getEventScheduleUpdateNotificationEmail(
      "Hack Night",
      "event-123",
      eventInformation
    );

    expect(html).toContain("/events/event-123/overview");
    expect(html).not.toContain("old-slug");
  });
});
