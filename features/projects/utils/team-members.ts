export interface TeamProfile {
  displayName: string | null;
  avatarUrl: string | null;
  affiliation: string | null;
}

export type TeamProfileByEmail = Record<string, TeamProfile>;

export interface TeamProfileRow {
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  affiliation: string | null;
}

export interface TeamMemberSource {
  lead_name: string;
  lead_email: string;
  teammates?: string[] | null;
}

export interface TeamParticipant {
  email: string;
  display_name?: string | null;
}

export interface TeamMember {
  email: string;
  displayName: string;
  role: "lead" | "member";
  affiliation: string | null;
  avatarUrl: string | null;
  subtitle: string | null;
}

const normalizeEmail = (value: string | null | undefined): string =>
  String(value || "").trim().toLowerCase();

const normalizeText = (value: string | null | undefined): string | null => {
  const normalized = String(value || "").trim();
  return normalized.length ? normalized : null;
};

export function getInitials(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "?";

  const parts = trimmed.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  const initials = (first + last).toUpperCase();
  return initials || trimmed.slice(0, 2).toUpperCase();
}

export function getTeamProfileEmails(project: TeamMemberSource): string[] {
  const deduped = new Set<string>();

  const leadEmail = normalizeEmail(project.lead_email);
  if (leadEmail) {
    deduped.add(leadEmail);
  }

  for (const teammate of project.teammates ?? []) {
    const teammateEmail = normalizeEmail(teammate);
    if (teammateEmail) {
      deduped.add(teammateEmail);
    }
  }

  return Array.from(deduped);
}

export function buildTeamProfileByEmail(
  rows: TeamProfileRow[] | null | undefined
): TeamProfileByEmail {
  const byEmail: TeamProfileByEmail = {};
  for (const row of rows ?? []) {
    const email = normalizeEmail(row.email);
    if (!email) continue;

    byEmail[email] = {
      displayName: normalizeText(row.display_name),
      avatarUrl: normalizeText(row.avatar_url),
      affiliation: normalizeText(row.affiliation),
    };
  }
  return byEmail;
}

function getMemberSubtitle(
  displayName: string,
  email: string,
  profile: TeamProfile | undefined
): string | null {
  if (profile?.affiliation) {
    return profile.affiliation;
  }

  if (displayName.toLowerCase() === email.toLowerCase()) {
    return email;
  }

  return null;
}

export function buildTeamMembers(
  project: TeamMemberSource,
  teamProfileByEmail: TeamProfileByEmail,
  participants: TeamParticipant[] = []
): TeamMember[] {
  const participantNameByEmail = new Map<string, string>();
  for (const participant of participants) {
    const email = normalizeEmail(participant.email);
    const displayName = normalizeText(participant.display_name);
    if (!email || !displayName) continue;
    participantNameByEmail.set(email, displayName);
  }

  const members: TeamMember[] = [];
  const seen = new Set<string>();

  const leadEmail = normalizeEmail(project.lead_email);
  const leadProfile = teamProfileByEmail[leadEmail];
  const leadDisplayName =
    normalizeText(leadProfile?.displayName) ||
    normalizeText(project.lead_name) ||
    leadEmail;
  if (leadEmail) {
    members.push({
      email: leadEmail,
      displayName: leadDisplayName,
      role: "lead",
      affiliation: leadProfile?.affiliation ?? null,
      avatarUrl: leadProfile?.avatarUrl ?? null,
      subtitle: getMemberSubtitle(leadDisplayName, leadEmail, leadProfile),
    });
    seen.add(leadEmail);
  }

  for (const teammateEmailRaw of project.teammates ?? []) {
    const teammateEmail = normalizeEmail(teammateEmailRaw);
    if (!teammateEmail || seen.has(teammateEmail)) {
      continue;
    }

    const profile = teamProfileByEmail[teammateEmail];
    const participantDisplayName = participantNameByEmail.get(teammateEmail) || null;
    const displayName =
      normalizeText(profile?.displayName) ||
      participantDisplayName ||
      teammateEmail;

    members.push({
      email: teammateEmail,
      displayName,
      role: "member",
      affiliation: profile?.affiliation ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
      subtitle: getMemberSubtitle(displayName, teammateEmail, profile),
    });
    seen.add(teammateEmail);
  }

  return members;
}

export function getPublicProjectShareUrl(
  origin: string | null | undefined,
  projectId: string
): string {
  const safeOrigin = String(origin || "").trim().replace(/\/$/, "");
  if (!safeOrigin) {
    return `/projects/public/${projectId}`;
  }

  return `${safeOrigin}/projects/public/${projectId}`;
}
