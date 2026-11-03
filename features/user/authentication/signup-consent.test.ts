import {
  appendConsentParams,
  buildSignupConsentMetadata,
  hasRecordedTermsAcceptance,
  parseConsentParams,
  TERMS_VERSION,
} from "./signup-consent";

const now = new Date("2026-11-02T12:00:00.000Z");

describe("buildSignupConsentMetadata", () => {
  it("records terms acceptance and marketing opt-in with a timestamp", () => {
    expect(
      buildSignupConsentMetadata({ acceptedTerms: true, marketingOptIn: true }, now)
    ).toEqual({
      terms_accepted_at: now.toISOString(),
      terms_version: TERMS_VERSION,
      marketing_opt_in: true,
      marketing_opt_in_at: now.toISOString(),
    });
  });

  it("records an explicit marketing opt-out with no opt-in timestamp", () => {
    expect(
      buildSignupConsentMetadata({ acceptedTerms: true, marketingOptIn: false }, now)
    ).toMatchObject({ marketing_opt_in: false, marketing_opt_in_at: null });
  });

  it("refuses to build metadata when terms were not accepted", () => {
    expect(() =>
      buildSignupConsentMetadata({ acceptedTerms: false, marketingOptIn: true }, now)
    ).toThrow(/Terms must be accepted/);
  });
});

describe("consent query params", () => {
  const base = "https://example.test/auth/callback?returnUrl=%2Fevents";

  it.each([
    [{ acceptedTerms: true, marketingOptIn: true }],
    [{ acceptedTerms: true, marketingOptIn: false }],
  ])("round-trips %j through the callback URL", (consent) => {
    const url = new URL(appendConsentParams(base, consent));
    expect(url.searchParams.get("returnUrl")).toBe("/events");
    expect(parseConsentParams(url.searchParams)).toEqual(consent);
  });

  it("uses ? when the URL has no query string", () => {
    expect(
      appendConsentParams("https://example.test/cb", { acceptedTerms: true, marketingOptIn: false })
    ).toBe("https://example.test/cb?acceptTerms=1");
  });

  it("adds nothing when terms were not accepted, even with marketing opt-in", () => {
    expect(appendConsentParams(base, { acceptedTerms: false, marketingOptIn: true })).toBe(base);
  });

  it.each(["", "acceptTerms=0", "acceptTerms=true", "marketingOptIn=1"])(
    "does not treat %p as terms acceptance",
    (query) => {
      expect(parseConsentParams(new URLSearchParams(query)).acceptedTerms).toBe(false);
    }
  );
});

describe("hasRecordedTermsAcceptance", () => {
  it.each([
    [null, false],
    [undefined, false],
    [{}, false],
    [{ terms_accepted_at: 123 }, false],
    [{ terms_accepted_at: "2026-11-02T12:00:00.000Z" }, true],
  ])("%j -> %p", (metadata, expected) => {
    expect(hasRecordedTermsAcceptance(metadata as Record<string, unknown> | null)).toBe(expected);
  });
});
