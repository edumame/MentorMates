jest.mock("nodemailer");

import nodemailer from "nodemailer";
import { sendEventApprovalNotification } from "../send-event-approval-notification";

const mockSendMail = jest.fn().mockResolvedValue({ messageId: "test-id" });

(nodemailer.createTransport as jest.Mock).mockReturnValue({
  sendMail: mockSendMail,
});

const sampleData = {
  eventName: "TreeHacks 2025",
  organizerName: "Jane Doe",
  organizerEmail: "jane@example.com",
  eventDate: "2025-02-27",
  location: "Stanford University",
  eventId: "abc-123",
};

describe("sendEventApprovalNotification", () => {
  beforeEach(() => {
    mockSendMail.mockClear();
    mockSendMail.mockResolvedValue({ messageId: "test-id" });
  });

  it("sends emails to all 3 admin recipients", async () => {
    const result = await sendEventApprovalNotification(sampleData);

    expect(mockSendMail).toHaveBeenCalledTimes(3);
    expect(result.sent).toBe(3);
    expect(result.failed).toBe(0);
  });

  it("sends to admin@mentormates.ai, chinatchinat123@gmail.com, and jefferyjzhou@gmail.com", async () => {
    await sendEventApprovalNotification(sampleData);

    const recipients = mockSendMail.mock.calls.map(
      (call: unknown[]) => (call[0] as { to: string }).to
    );

    expect(recipients).toContain("admin@mentormates.ai");
    expect(recipients).toContain("chinatchinat123@gmail.com");
    expect(recipients).toContain("jefferyjzhou@gmail.com");
  });

  it("uses [IMPORTANT] and Approve in the subject line", async () => {
    await sendEventApprovalNotification(sampleData);

    const subject = mockSendMail.mock.calls[0][0].subject;

    expect(subject).toContain("[IMPORTANT]");
    expect(subject).toContain("Approve");
    expect(subject).toContain("TreeHacks 2025");
  });

  it("includes event details in the email body", async () => {
    await sendEventApprovalNotification(sampleData);

    const html = mockSendMail.mock.calls[0][0].html;

    expect(html).toContain("TreeHacks 2025");
    expect(html).toContain("Jane Doe");
    expect(html).toContain("jane@example.com");
    expect(html).toContain("Stanford University");
  });

  it("handles partial failures gracefully", async () => {
    mockSendMail
      .mockResolvedValueOnce({ messageId: "1" })
      .mockResolvedValueOnce({ messageId: "2" })
      .mockRejectedValueOnce(new Error("SMTP error"));

    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const result = await sendEventApprovalNotification(sampleData);

    expect(result.sent).toBe(2);
    expect(result.failed).toBe(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to send some approval notification emails:",
      expect.any(Array)
    );

    consoleSpy.mockRestore();
  });
});
