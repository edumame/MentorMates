/**
 * Canonical share/feedback link for a project, used by both project-detail
 * routes (MENT-016: the public route used window.location.href, so the QR
 * carried query strings/hashes and differed from the private route's link).
 */
export function getProjectFeedbackUrl(projectId: string, origin?: string): string {
  const base =
    origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/projects/public/${encodeURIComponent(projectId)}`;
}
