import { EventRole } from "@/lib/types";

export const JOIN_EVENT_TO_VOTE_MESSAGE =
  "Join this event to vote for popular projects.";
export const JUDGE_VOTING_BLOCK_MESSAGE =
  "Judges can score projects but cannot vote in the Popular Project category.";

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

  if (role.toLowerCase() === EventRole.Judge) {
    return {
      canVote: false,
      blockedReason: JUDGE_VOTING_BLOCK_MESSAGE,
    };
  }

  return {
    canVote: true,
    blockedReason: null,
  };
}
