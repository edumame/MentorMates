/** @jest-environment node */

import { sendHtmlEmail } from "./send-html-email";

const mockSend = jest.fn();

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: (...args: unknown[]) => mockSend(...args) },
  })),
}));

describe("sendHtmlEmail", () => {
  const originalKey = process.env.RESEND_API_KEY;
  const message = { to: "a@email.com", subject: "Hi", html: "<p>Hi</p>" };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RESEND_API_KEY = "test-key";
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.RESEND_API_KEY = originalKey;
    jest.restoreAllMocks();
  });

  it("returns true when the email is accepted", async () => {
    mockSend.mockResolvedValue({ error: null });

    await expect(sendHtmlEmail(message)).resolves.toBe(true);
  });

  it("returns false without a Resend key", async () => {
    delete process.env.RESEND_API_KEY;

    await expect(sendHtmlEmail(message)).resolves.toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("returns false when Resend reports an error", async () => {
    mockSend.mockResolvedValue({ error: { message: "rejected" } });

    await expect(sendHtmlEmail(message)).resolves.toBe(false);
  });

  it("returns false when Resend throws", async () => {
    mockSend.mockRejectedValue(new Error("network"));

    await expect(sendHtmlEmail(message)).resolves.toBe(false);
  });
});
