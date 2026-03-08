import {
  getPopularVotePermission,
  JUDGE_VOTING_BLOCK_MESSAGE,
  JOIN_EVENT_TO_VOTE_MESSAGE,
} from "./voting-permissions";

describe("getPopularVotePermission", () => {
  it("blocks voting when user has not joined the event", () => {
    expect(getPopularVotePermission(null)).toEqual({
      canVote: false,
      blockedReason: JOIN_EVENT_TO_VOTE_MESSAGE,
    });
    expect(getPopularVotePermission(undefined)).toEqual({
      canVote: false,
      blockedReason: JOIN_EVENT_TO_VOTE_MESSAGE,
    });
  });

  it("blocks judges from popular project voting", () => {
    expect(getPopularVotePermission("judge")).toEqual({
      canVote: false,
      blockedReason: JUDGE_VOTING_BLOCK_MESSAGE,
    });
    expect(getPopularVotePermission("JUDGE")).toEqual({
      canVote: false,
      blockedReason: JUDGE_VOTING_BLOCK_MESSAGE,
    });
  });

  it("allows non-judge event roles to vote", () => {
    expect(getPopularVotePermission("participant")).toEqual({
      canVote: true,
      blockedReason: null,
    });
    expect(getPopularVotePermission("mentor")).toEqual({
      canVote: true,
      blockedReason: null,
    });
    expect(getPopularVotePermission("organizer")).toEqual({
      canVote: true,
      blockedReason: null,
    });
    expect(getPopularVotePermission("admin")).toEqual({
      canVote: true,
      blockedReason: null,
    });
  });
});
