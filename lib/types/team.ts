// Types for the team formation feature.

export enum TeamMemberRole {
  Lead = "lead",
  Member = "member",
}

export interface Team {
  id: string;
  event_id: string;
  name: string;
  created_by: string | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  event_id: string;
  role: TeamMemberRole;
  joined_at: string;
}

// A lightweight member shape enriched with profile fields for display.
export interface TeamMemberWithProfile extends TeamMember {
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export interface TeamWithMembers extends Team {
  members: TeamMemberWithProfile[];
}
