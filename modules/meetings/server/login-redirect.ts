/** Login URL that returns the user to `path` after sign-in (login reads ?returnUrl=). */
export function loginRedirectFor(path: string): string {
  return `/login?returnUrl=${encodeURIComponent(path)}`;
}
