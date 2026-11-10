import { EventVisibility } from "@/lib/types";
import {
  getEventInviteAcceptanceUrl,
  getOrganizerInviteAcceptanceUrl,
  getEventOverviewUrl,
  normalizeInviteEmails,
  sendEventInviteEmails,
  sendOrganizerInviteEmails,
} from "./invite-emails";

jest.mock("@/lib/events/role-invitations", () => ({
  issueEventRoleInviteToken: jest.fn().mockResolvedValue("signed-token"),
}));

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
            "event-123",
            "participant",
            "participant@email.com",
            "signed-token"
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
            "event-123",
            "judge",
            "judge@email.com",
            "signed-token"
          )
        ),
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining(
          getEventOverviewUrl("https://mentormates.ai/", "event-123")
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

  it.each(["", "mentormates.ai", "/events", "javascript:alert(1)", "https://mentormates.ai/wrong-path", "https://mentormates.ai?query=1"])(
    "does not send broken organizer links for origin %s",
    async (appOrigin) => {
      const sendEmail = jest.fn().mockResolvedValue(true);
      const summary = await sendOrganizerInviteEmails({
        appOrigin,
        eventId: "event-123",
        eventName: "Hack Night",
        inviterName: "Casey",
        existingOrganizerEmails: ["existing@email.com"],
        newOrganizerEmails: ["new@email.com"],
        sendEmail,
      });
      expect(summary).toEqual({ sent: 0, failed: ["existing@email.com", "new@email.com"] });
      expect(sendEmail).not.toHaveBeenCalled();
    }
  );

  it("sends organizer invites for existing and new organizers", async () => {
    const sendEmail = jest.fn().mockResolvedValue(true);

    const summary = await sendOrganizerInviteEmails({
      appOrigin: "https://mentormates.ai",
      eventId: "event-123",
      eventName: "Hack Night",
      inviterName: "Casey Organizer",
      existingOrganizerEmails: ["existing@email.com"],
      newOrganizerEmails: ["new@email.com"],
      sendEmail,
    });

    expect(summary).toEqual({
      sent: 2,
      failed: [],
    });

    expect(sendEmail).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        to: "existing@email.com",
        html: expect.stringContaining(
          getOrganizerInviteAcceptanceUrl("https://mentormates.ai", "event-123", "existing@email.com", "signed-token")
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
            "event-123",
            "new@email.com",
            "signed-token"
          )
        ),
      })
    );
  });
});
