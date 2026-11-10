import type { ProjectTeamMember } from "@/lib/types";

export interface CertificateSubject {
  /** user_profiles.uid; null when the member has no profile (no pinned link). */
  id: string | null;
  name: string;
}

/**
 * Whose name goes on the certificate: pinned member id -> signed-in team
 * member -> project lead. Works on the email-free roster only.
 */
export function pickCertificateSubject(
  members: ProjectTeamMember[],
  pinnedMemberId: string | null,
  viewerId: string | null,
): CertificateSubject | null {
  const byId = (id: string | null) =>
    id ? members.find((member) => member.id === id) : undefined;
  const chosen =
    byId(pinnedMemberId) ??
    byId(viewerId) ??
    members.find((member) => member.role === "lead");
  return chosen ? { id: chosen.id, name: chosen.display_name } : null;
}
