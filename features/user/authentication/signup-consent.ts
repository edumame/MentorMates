/**
 * Consent captured at sign-up: required acceptance of the Terms of Service and
 * Privacy Policy, plus an optional opt-in to the MentorMates mailing list.
 *
 * Consent is stored on the Supabase auth user's `user_metadata`. Email sign-up
 * passes it through `signUp({ options: { data } })`; OAuth sign-up carries it
 * through the callback URL and the callback route writes it with `updateUser`.
 */

/** Bump when the Terms or Privacy Policy change materially. */
export const TERMS_VERSION = "2026-11-02";

export const CONSENT_QUERY_PARAMS = {
  terms: "acceptTerms",
  marketing: "marketingOptIn",
} as const;

export type SignupConsent = {
  acceptedTerms: boolean;
  marketingOptIn: boolean;
};

export type SignupConsentMetadata = {
  terms_accepted_at: string;
  terms_version: string;
  marketing_opt_in: boolean;
  marketing_opt_in_at: string | null;
};

export function buildSignupConsentMetadata(
  consent: SignupConsent,
  now: Date = new Date()
): SignupConsentMetadata {
  if (!consent.acceptedTerms) {
    throw new Error("Terms must be accepted before consent can be recorded");
  }
  const timestamp = now.toISOString();
  return {
    terms_accepted_at: timestamp,
    terms_version: TERMS_VERSION,
    marketing_opt_in: consent.marketingOptIn,
    marketing_opt_in_at: consent.marketingOptIn ? timestamp : null,
  };
}

/** Appends consent flags to a URL (used for the OAuth callback redirect). */
export function appendConsentParams(url: string, consent: SignupConsent) {
  if (!consent.acceptedTerms) return url;
  const params = new URLSearchParams({ [CONSENT_QUERY_PARAMS.terms]: "1" });
  if (consent.marketingOptIn) params.set(CONSENT_QUERY_PARAMS.marketing, "1");
  return `${url}${url.includes("?") ? "&" : "?"}${params.toString()}`;
}

/** Reads consent flags back from the OAuth callback URL. */
export function parseConsentParams(searchParams: URLSearchParams): SignupConsent {
  return {
    acceptedTerms: searchParams.get(CONSENT_QUERY_PARAMS.terms) === "1",
    marketingOptIn: searchParams.get(CONSENT_QUERY_PARAMS.marketing) === "1",
  };
}

/** True if the user already has a recorded acceptance of the Terms. */
export function hasRecordedTermsAcceptance(
  userMetadata: Record<string, unknown> | null | undefined
) {
  return typeof userMetadata?.terms_accepted_at === "string";
}
