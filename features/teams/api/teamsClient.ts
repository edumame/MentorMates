import { TeamWithMembers } from "@/lib/types/team";
import { EventRole } from "@/lib/types";
import { fetchAllEventUsers } from "@/features/user/dashboards/dashboard/organizer/participants/fetch-event-users";

export interface RosterUser {
  uid: string;
  display_name: string | null;
}

export interface TeamsResponse {
  myTeam: TeamWithMembers | null;
  teams: TeamWithMembers[];
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body?.error || "Something went wrong";
  } catch {
    return "Something went wrong";
  }
}

export async function fetchTeams(eventId: string): Promise<TeamsResponse> {
  const res = await fetch(`/api/events/${eventId}/teams`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

// Fetches every event participant (used as the teammate candidate pool).
// Pages through the users API (ORG-024: a single limit=500 call silently
// dropped participants beyond the first 500).
export async function fetchParticipants(
  eventId: string
): Promise<RosterUser[]> {
  const { users } = await fetchAllEventUsers(eventId, [EventRole.Participant]);
  return users.map((u) => ({
    uid: u.uid || u.user_id || "",
    display_name: u.display_name,
  }));
}

export async function createTeam(
  eventId: string,
  input: { name: string; memberUserIds?: string[] }
): Promise<TeamWithMembers> {
  const res = await fetch(`/api/events/${eventId}/teams`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()).team;
}

export async function patchTeam(
  eventId: string,
  input: {
    teamId: string;
    name?: string;
    addUserIds?: string[];
    removeUserIds?: string[];
    projectId?: string | null;
  }
): Promise<TeamWithMembers> {
  const res = await fetch(`/api/events/${eventId}/teams`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()).team;
}

// Removes a single member (or, when userId is omitted, dissolves the team).
export async function deleteTeamOrMember(
  eventId: string,
  teamId: string,
  userId?: string
): Promise<void> {
  const params = new URLSearchParams({ teamId });
  if (userId) params.set("userId", userId);
  const res = await fetch(`/api/events/${eventId}/teams?${params.toString()}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await parseError(res));
}
