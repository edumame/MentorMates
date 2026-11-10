import { EventRole } from "@/lib/types";

export const JOIN_EVENT_TO_VOTE_MESSAGE =
  "Join this event to vote for popular projects.";
export const JUDGE_VOTING_BLOCK_MESSAGE =
  "Judges can score projects but cannot vote in the Popular Project category.";
export const ORGANIZER_VOTING_BLOCK_MESSAGE =
  "Organizers can see live vote totals, so they cannot vote in the Popular Project category.";
export const OWN_PROJECT_VOTE_BLOCK_MESSAGE =
  "You can't vote for your own project.";

/**
 * Event roles allowed to cast popular votes. Must match the role check in
 * public.cast_project_vote (supabase/migrations/202611080103_a1_popular_vote_integrity.sql).
 */
export const POPULAR_VOTE_ROLES: readonly string[] = [
  EventRole.Participant,
  EventRole.Mentor,
];

export interface PopularVotePermission {
  canVote: boolean;
  blockedReason: string | null;
}

export function getPopularVotePermission(
  role: string | null | undefined
): PopularVotePermission {
  if (!role) {
    return {
      canVote: false,
      blockedReason: JOIN_EVENT_TO_VOTE_MESSAGE,
    };
  }

  const normalizedRole = role.toLowerCase();

  if (normalizedRole === EventRole.Judge) {
    return {
      canVote: false,
      blockedReason: JUDGE_VOTING_BLOCK_MESSAGE,
    };
  }

  if (!POPULAR_VOTE_ROLES.includes(normalizedRole)) {
    return {
      canVote: false,
      blockedReason: ORGANIZER_VOTING_BLOCK_MESSAGE,
    };
  }

  return {
    canVote: true,
    blockedReason: null,
  };
}
