import {
  getCheckinQRCodeEmail,
  getEventScheduleUpdateNotificationEmail,
  getEventUpdateNotificationEmail,
} from "../event-notifications";
import type { EventDetails } from "../../types";

const NAME = '</h1><a href="https://evil">R&D</a>';
const event = { slug: "hack", event_schedule: [] } as unknown as EventDetails;

describe("event notification templates", () => {
  it.each([
    ["check-in", () => getCheckinQRCodeEmail(NAME, "user-1", "event-1")],
    ["event update", () => getEventUpdateNotificationEmail(NAME, "event-1", event)],
    ["schedule update", () => getEventScheduleUpdateNotificationEmail(NAME, "event-1", event)],
  ])("escapes the event name in %s html but not the subject", async (_label, render) => {
    const { html, subject } = await render();

    expect(html).not.toContain("<a href=\"https://evil\"");
    expect(html).not.toContain("</h1><a");
    expect(html).toContain("R&amp;D");
    expect(subject).toContain(NAME);
  });

  it("encodes the ids in the ticket link", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://mentormates.ai";

    const { html } = await getCheckinQRCodeEmail(
      "Hack",
      'user"1',
      '"><a href=https://evil>x&y'
    );

    expect(html).not.toContain("href=https://evil");
    expect(html).toContain(
      `https://mentormates.ai/ticket?evt=${encodeURIComponent('"><a href=https://evil>x&y')}&usr=${encodeURIComponent('user"1')}`
    );
  });
});
