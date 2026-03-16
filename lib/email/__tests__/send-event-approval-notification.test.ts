const mockSend = jest.fn().mockResolvedValue({ data: { id: "test-id" }, error: null });

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

jest.mock("@/lib/email_templates/constants", () => ({
  NOTIFICATIONS_EMAIL_FROM: "MentorMates <notifications@hello.mentormates.ai>",
}));

import { sendEventApprovalNotification } from "../send-event-approval-notification";

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
    mockSend.mockClear();
    mockSend.mockResolvedValue({ data: { id: "test-id" }, error: null });
    process.env.RESEND_API_KEY = "re_test_key";
  });

  it("sends emails to all 3 admin recipients", async () => {
    const result = await sendEventApprovalNotification(sampleData);

    expect(mockSend).toHaveBeenCalledTimes(3);
    expect(result.sent).toBe(3);
    expect(result.failed).toBe(0);
  });

  it("sends to admin@mentormates.ai, chinatchinat123@gmail.com, and jefferyjzhou@gmail.com", async () => {
    await sendEventApprovalNotification(sampleData);

    const recipients = mockSend.mock.calls.map(
      (call: unknown[]) => (call[0] as { to: string }).to
    );

    expect(recipients).toContain("admin@mentormates.ai");
    expect(recipients).toContain("chinatchinat123@gmail.com");
    expect(recipients).toContain("jefferyjzhou@gmail.com");
  });

  it("sends from the MentorMates notifications address", async () => {
    await sendEventApprovalNotification(sampleData);

    const from = mockSend.mock.calls[0][0].from;
    expect(from).toBe("MentorMates <notifications@hello.mentormates.ai>");
  });

  it("uses [IMPORTANT] and Approve in the subject line", async () => {
    await sendEventApprovalNotification(sampleData);

    const subject = mockSend.mock.calls[0][0].subject;

    expect(subject).toContain("[IMPORTANT]");
    expect(subject).toContain("Approve");
    expect(subject).toContain("TreeHacks 2025");
  });

  it("includes event details in the email body", async () => {
    await sendEventApprovalNotification(sampleData);

    const html = mockSend.mock.calls[0][0].html;

    expect(html).toContain("TreeHacks 2025");
    expect(html).toContain("Jane Doe");
    expect(html).toContain("jane@example.com");
    expect(html).toContain("Stanford University");
  });

  it("handles partial failures gracefully", async () => {
    mockSend
      .mockResolvedValueOnce({ data: { id: "1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "2" }, error: null })
      .mockRejectedValueOnce(new Error("Resend API error"));

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

  it("returns all failed when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY;

    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const result = await sendEventApprovalNotification(sampleData);

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(3);
    expect(mockSend).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
