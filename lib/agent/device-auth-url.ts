/**
 * Login redirect for the device approval page. Both the inner device URL and
 * the returnUrl query value are encoded so the code survives the round trip
 * through /login (an unencoded "?code=" would be parsed as part of /login's
 * own query string).
 */
export function buildDeviceLoginUrl(code: string): string {
  const returnUrl = code
    ? `/auth/device?code=${encodeURIComponent(code)}`
    : "/auth/device";
  return `/login?returnUrl=${encodeURIComponent(returnUrl)}`;
}
