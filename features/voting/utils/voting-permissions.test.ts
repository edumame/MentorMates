import {
  getPopularVotePermission,
  JUDGE_VOTING_BLOCK_MESSAGE,
  JOIN_EVENT_TO_VOTE_MESSAGE,
  ORGANIZER_VOTING_BLOCK_MESSAGE,
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

  it("allows participants and mentors to vote", () => {
    expect(getPopularVotePermission("participant")).toEqual({
      canVote: true,
      blockedReason: null,
    });
    expect(getPopularVotePermission("Participant")).toEqual({
      canVote: true,
      blockedReason: null,
    });
    expect(getPopularVotePermission("mentor")).toEqual({
      canVote: true,
      blockedReason: null,
    });
  });

  it("blocks organizers and admins, who can see live totals (mirrors cast_project_vote)", () => {
    for (const role of ["organizer", "admin", "ORGANIZER"]) {
      expect(getPopularVotePermission(role)).toEqual({
        canVote: false,
        blockedReason: ORGANIZER_VOTING_BLOCK_MESSAGE,
      });
    }
  });

  it("blocks unknown roles", () => {
    expect(getPopularVotePermission("event").canVote).toBe(false);
    expect(getPopularVotePermission("something-else").canVote).toBe(false);
  });
});
