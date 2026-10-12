import { getSafeRedirectPath, normalizeInternalPath } from "./redirect-url";

describe("redirect-url", () => {
  it("keeps relative internal paths with query strings", () => {
    expect(getSafeRedirectPath("/join-project?project=1&token=abc")).toBe(
      "/join-project?project=1&token=abc"
    );
  });

  it("allows same-origin absolute URLs as internal paths", () => {
    expect(
      getSafeRedirectPath(
        "https://mentormates.test/projects/123?tab=details",
        "https://mentormates.test"
      )
    ).toBe("/projects/123?tab=details");
  });

  it("rejects external and protocol-relative URLs", () => {
    expect(
      getSafeRedirectPath(
        "https://example.com/projects/123",
        "https://mentormates.test"
      )
    ).toBeNull();
    expect(normalizeInternalPath("//example.com/projects/123")).toBeNull();
  });

  it("rejects auth and system routes as redirect targets", () => {
    expect(getSafeRedirectPath("/login?returnUrl=/projects/123")).toBeNull();
    expect(getSafeRedirectPath("/auth/callback?code=abc")).toBeNull();
    expect(getSafeRedirectPath("/onboarding?returnUrl=/events/1")).toBeNull();
  });
});
