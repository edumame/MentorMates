/**
 * @jest-environment node
 */

import { isValidCheckinQRSignature } from "@/lib/checkin/qr-signature";
import { getCheckinQRCodeEmail } from "../event-notifications";

jest.mock("server-only", () => ({}), { virtual: true });

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

describe("getCheckinQRCodeEmail", () => {
  const originalSecret = process.env.CHECKIN_QR_SECRET;
  const originalOrigin = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    process.env.CHECKIN_QR_SECRET = "test-checkin-secret";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.test";
  });

  afterAll(() => {
    process.env.CHECKIN_QR_SECRET = originalSecret;
    process.env.NEXT_PUBLIC_APP_URL = originalOrigin;
  });

  it("links to a ticket the check-in route will accept", async () => {
    const { html } = await getCheckinQRCodeEmail("Hack", USER_ID, EVENT_ID);

    const href = html.match(/href="([^"]+)"/)?.[1];
    const link = new URL(href ?? "");

    expect(link.origin + link.pathname).toBe("https://app.test/ticket");
    expect(link.searchParams.get("evt")).toBe(EVENT_ID);
    expect(link.searchParams.get("usr")).toBe(USER_ID);
    expect(
      isValidCheckinQRSignature(EVENT_ID, USER_ID, link.searchParams.get("sig"))
    ).toBe(true);
  });

  it("refuses to send an unsigned ticket when the secret is unset", async () => {
    delete process.env.CHECKIN_QR_SECRET;

    await expect(
      getCheckinQRCodeEmail("Hack", USER_ID, EVENT_ID)
    ).rejects.toThrow("CHECKIN_QR_SECRET is not configured");
  });
});
