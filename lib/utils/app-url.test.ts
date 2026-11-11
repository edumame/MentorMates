import { getAppBaseUrl } from "./app-url";

describe("getAppBaseUrl (PUB-012)", () => {
  const original = process.env.NEXT_PUBLIC_APP_URL;
  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = original;
  });

  it("prefers the configured app URL over the request origin", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.test/";
    expect(getAppBaseUrl("https://evil.example")).toBe("https://app.example.test");
  });

  it("falls back to a valid request origin, then localhost", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(getAppBaseUrl("http://localhost:3107")).toBe("http://localhost:3107");
    expect(getAppBaseUrl("null")).toBe("http://localhost:3000");
    expect(getAppBaseUrl("javascript:alert(1)")).toBe("http://localhost:3000");
  });
});
