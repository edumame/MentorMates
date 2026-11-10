// Shared approval-status rules (PUB-001 / PUB-019).

/** Listings still in, or refused by, admin review. */
export const UNREVIEWED_APPROVAL_STATUSES: ReadonlySet<string> = new Set(["submitted", "rejected"]);

export function isUnreviewedApprovalStatus(status: string | null | undefined) {
  return Boolean(status && UNREVIEWED_APPROVAL_STATUSES.has(status));
}

/** Only an admin-approved event may send visitors to an off-site URL. */
export function isApprovedApprovalStatus(status: string | null | undefined) {
  return status === "approved";
}

/** http(s) URLs only: javascript:, data: and other schemes are rejected. */
export function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const { protocol } = new URL(value.trim());
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

/** Use as an href only when it is an http(s) URL. */
export function safeExternalHref(value: string | null | undefined) {
  return isHttpUrl(value) ? value.trim() : undefined;
}
