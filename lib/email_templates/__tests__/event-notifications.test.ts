import {
  getCheckinQRCodeEmail,
  getEventScheduleUpdateNotificationEmail,
  getEventUpdateNotificationEmail,
} from "../event-notifications";
import { escapeHtml, plainTextSubject } from "../escape-html";
import type { EventDetails } from "@/lib/types";

const hostile = '<a href="https://phish.example.test/x">Claim prize</a>';

describe("event notification templates escape interpolated values (ORG-019/PUB-004)", () => {
  it("escapes the event name in update emails and keeps a safe link", () => {
    const email = getEventUpdateNotificationEmail(hostile, "evt-1", { slug: 'x"><script>' } as unknown as EventDetails);
    expect(email.html).not.toContain("<a href=\"https://phish");
    expect(email.html).toContain("&lt;a href=&quot;https://phish.example.test/x&quot;&gt;");
    expect(email.html).not.toContain("<script>");
    // The link uses the immutable event id, never the (editable) slug.
    expect(email.html).toContain('href="https://mentormates.ai/events/evt-1/overview"');
  });

  it("escapes schedule entries and tolerates a missing schedule", () => {
    const withSchedule = getEventScheduleUpdateNotificationEmail("Hack", "evt-1", {
      event_schedule: [{ time: "<b>Fri</b>", events: [{ name: "<img src=x>", time: "9" }] }],
    } as unknown as EventDetails);
    expect(withSchedule.html).toContain("&lt;b&gt;Fri&lt;/b&gt;");
    expect(withSchedule.html).not.toContain("<img src=x>");
    expect(() => getEventScheduleUpdateNotificationEmail("Hack", "evt-1", {} as EventDetails)).not.toThrow();
  });

  it("escapes check-in emails and strips newlines from subjects", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://mentormates.ai";
    const email = await getCheckinQRCodeEmail(`${hostile}\r\nBcc: x`, "evt-1");
    expect(email.html).not.toContain("<a href=\"https://phish");
    expect(email.subject).not.toMatch(/[\r\n]/);
    expect(email.html).toContain("/ticket?evt=evt-1");
    expect(email.html).not.toContain("usr=");
  });

  it("escapeHtml and plainTextSubject handle all special characters", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
    expect(plainTextSubject("a\n\tb")).toBe("a b");
  });
});
