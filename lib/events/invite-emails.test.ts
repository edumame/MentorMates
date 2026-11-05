import { EventVisibility } from "@/lib/types";
import {
  getEventInviteAcceptanceUrl,
  getOrganizerInviteAcceptanceUrl,
  getEventOverviewUrl,
  normalizeInviteEmails,
  sendEventInviteEmails,
  sendOrganizerInviteEmails,
  getDeferredOrganizerInviteNotice,
} from "./invite-emails";

describe("event invite emails", () => {
  it("normalizes and deduplicates invite email lists", () => {
    expect(
      normalizeInviteEmails([
        " Judge@Email.com ",
        "judge@email.com",
        "",
        "participant@email.com",
      ])
    ).toEqual(["judge@email.com", "participant@email.com"]);
  });

  it("sends participant and judge invites for published events", async () => {
    const sendEmail = jest.fn().mockResolvedValue(true);

    const summary = await sendEventInviteEmails({
      appOrigin: "https://mentormates.ai/",
      eventId: "event-123",
      eventName: "Hack Night",
      eventSlug: "hack-night",
      inviterName: "Casey Organizer",
      visibility: EventVisibility.Private,
      participantInviteEmails: ["participant@email.com", "participant@email.com"],
      judgeInviteEmails: ["judge@email.com"],
      sendEmail,
    });

    expect(summary).toEqual({
      deferred: false,
      sent: {
        participant: 1,
        judge: 1,
      },
      failed: {
        participant: [],
        judge: [],
      },
    });

    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        to: "participant@email.com",
        subject: expect.stringContaining("participant"),
        html: expect.stringContaining(
          getEventInviteAcceptanceUrl(
            "https://mentormates.ai/",
            "hack-night",
            "participant",
            "participant@email.com"
          )
        ),
      })
    );
    expect(sendEmail).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        to: "judge@email.com",
        subject: expect.stringContaining("judge"),
        html: expect.stringContaining(
          getEventInviteAcceptanceUrl(
            "https://mentormates.ai/",
            "hack-night",
            "judge",
            "judge@email.com"
          )
        ),
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining(
          getEventOverviewUrl("https://mentormates.ai/", "hack-night")
        ),
      })
    );
  });

  it("defers invite emails for draft events", async () => {
    const sendEmail = jest.fn();

    const summary = await sendEventInviteEmails({
      appOrigin: "https://mentormates.ai",
      eventId: "event-123",
      eventName: "Hack Night",
      inviterName: "Casey Organizer",
      visibility: EventVisibility.Draft,
      participantInviteEmails: ["participant@email.com"],
      judgeInviteEmails: ["judge@email.com"],
      sendEmail,
    });

    expect(summary).toEqual({
      deferred: true,
      sent: {
        participant: 0,
        judge: 0,
      },
      failed: {
        participant: [],
        judge: [],
      },
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("can send judge invites for draft events when draft deferral is disabled", async () => {
    const sendEmail = jest.fn().mockResolvedValue(true);

    const summary = await sendEventInviteEmails({
      appOrigin: "https://mentormates.ai",
      eventId: "event-123",
      eventName: "Hack Night",
      inviterName: "Casey Organizer",
      visibility: EventVisibility.Draft,
      judgeInviteEmails: ["judge@email.com"],
      deferIfDraft: false,
      sendEmail,
    });

    expect(summary).toEqual({
      deferred: false,
      sent: {
        participant: 0,
        judge: 1,
      },
      failed: {
        participant: [],
        judge: [],
      },
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("sends organizer invites for existing and new organizers", async () => {
    const sendEmail = jest.fn().mockResolvedValue(true);

    const summary = await sendOrganizerInviteEmails({
      appOrigin: "https://mentormates.ai",
      eventId: "event-123",
      eventName: "Hack Night",
      eventSlug: "hack-night",
      inviterName: "Casey Organizer",
      visibility: EventVisibility.Public,
      existingOrganizerEmails: ["existing@email.com"],
      newOrganizerEmails: ["new@email.com"],
      sendEmail,
    });

    expect(summary).toEqual({
      sent: 2,
      failed: [],
      deferred: [],
    });

    expect(sendEmail).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        to: "existing@email.com",
        html: expect.stringContaining(
          getEventOverviewUrl("https://mentormates.ai", "hack-night")
        ),
      })
    );

    expect(sendEmail).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        to: "new@email.com",
        html: expect.stringContaining(
          getOrganizerInviteAcceptanceUrl(
            "https://mentormates.ai",
            "hack-night",
            "new@email.com"
          )
        ),
      })
    );
  });

  it.each([
    EventVisibility.Draft,
    EventVisibility.Archived,
    EventVisibility.Test,
    EventVisibility.Demo,
  ])(
    "defers new organizers on a %s event because the accept link would 404",
    async (visibility) => {
      const sendEmail = jest.fn().mockResolvedValue(true);

      const summary = await sendOrganizerInviteEmails({
        appOrigin: "https://mentormates.ai",
        eventId: "event-123",
        eventName: "Hack Night",
        eventSlug: "hack-night",
        inviterName: "Casey Organizer",
        visibility,
        newOrganizerEmails: [" New@email.com ", "new@email.com"],
        sendEmail,
      });

      expect(summary).toEqual({
        sent: 0,
        failed: [],
        deferred: ["new@email.com"],
      });
      expect(sendEmail).not.toHaveBeenCalled();
    }
  );

  it("still emails existing organizers on a draft, who already hold a role", async () => {
    const sendEmail = jest.fn().mockResolvedValue(true);

    const summary = await sendOrganizerInviteEmails({
      appOrigin: "https://mentormates.ai",
      eventId: "event-123",
      eventName: "Hack Night",
      eventSlug: "hack-night",
      inviterName: "Casey Organizer",
      visibility: EventVisibility.Draft,
      existingOrganizerEmails: ["existing@email.com"],
      newOrganizerEmails: ["new@email.com"],
      sendEmail,
    });

    expect(summary).toEqual({
      sent: 1,
      failed: [],
      deferred: ["new@email.com"],
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "existing@email.com" })
    );
  });

  it("reports new organizers on a draft as deferred, not failed, when email is off", async () => {
    const summary = await sendOrganizerInviteEmails({
      appOrigin: "https://mentormates.ai",
      eventId: "event-123",
      eventName: "Hack Night",
      inviterName: "Casey Organizer",
      visibility: EventVisibility.Draft,
      newOrganizerEmails: ["new@email.com"],
    });

    expect(summary).toEqual({
      sent: 0,
      failed: [],
      deferred: ["new@email.com"],
    });
  });

  it("emails new organizers on a private event", async () => {
    const sendEmail = jest.fn().mockResolvedValue(true);

    const summary = await sendOrganizerInviteEmails({
      appOrigin: "https://mentormates.ai",
      eventId: "event-123",
      eventName: "Hack Night",
      inviterName: "Casey Organizer",
      visibility: EventVisibility.Private,
      newOrganizerEmails: ["new@email.com"],
      sendEmail,
    });

    expect(summary).toEqual({ sent: 1, failed: [], deferred: [] });
  });

  it("names the skipped people in the deferred notice", () => {
    expect(
      getDeferredOrganizerInviteNotice(["a@email.com", "b@email.com"])
    ).toContain("a@email.com, b@email.com");
  });
});
