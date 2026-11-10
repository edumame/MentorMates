"use client";

import { useCallback, useEffect, useState } from "react";
import type { VotingWindowStatus } from "@/features/voting/utils/voting-window";
import { OWN_PROJECT_VOTE_BLOCK_MESSAGE } from "@/features/voting/utils/voting-permissions";

interface UseEventVotesResult {
  // Vote counts per project: { projectId: count }
  voteCounts: Record<string, number>;
  // Project IDs that current user has voted for
  userVotes: string[];
  // Number of votes remaining for user
  remainingVotes: number;
  // Maximum votes allowed per user
  maxVotes: number;
  // Whether current user can cast popular votes
  canVote: boolean;
  // Reason voting is blocked (if blocked)
  blockedReason: string | null;
  // Projects the current user is on (cannot be voted for by them)
  ownProjectIds: string[];
  // Voting window state from the server
  votingStatus: VotingWindowStatus;
  votingOpensAt: string | null;
  votingClosesAt: string | null;
  // Loading state
  isLoading: boolean;
  // Error message
  error: string | null;
  // Check if user has voted for a specific project
  hasVoted: (projectId: string) => boolean;
  // Whether the project is the current user's own project
  isOwnProject: (projectId: string) => boolean;
  // Get vote count for a specific project (always 0 unless organizer/owner)
  getVoteCount: (projectId: string) => number;
  // Cast a vote for a project
  vote: (projectId: string) => Promise<boolean>;
  // Remove a vote from a project
  unvote: (projectId: string) => Promise<boolean>;
  // Toggle vote for a project
  toggleVote: (projectId: string) => Promise<boolean>;
  // Refresh vote data
  refresh: () => Promise<void>;
}

function readRemainingVotes(body: unknown): number | null {
  const value = (body as { remainingVotes?: unknown } | null)?.remainingVotes;
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : null;
}

export function useEventVotes(eventId: string): UseEventVotesResult {
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [userVotes, setUserVotes] = useState<string[]>([]);
  const [remainingVotes, setRemainingVotes] = useState(0);
  const [maxVotes, setMaxVotes] = useState(3);
  const [canVote, setCanVote] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [ownProjectIds, setOwnProjectIds] = useState<string[]>([]);
  const [votingStatus, setVotingStatus] = useState<VotingWindowStatus>("open");
  const [votingOpensAt, setVotingOpensAt] = useState<string | null>(null);
  const [votingClosesAt, setVotingClosesAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!eventId) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/events/${eventId}/votes`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Failed to load votes");
      }
      const data = await res.json();
      setVoteCounts(data.voteCounts || {});
      setUserVotes(data.userVotes || []);
      setRemainingVotes(data.remainingVotes ?? 0);
      setMaxVotes(data.maxVotes ?? 3);
      setCanVote(Boolean(data.canVote));
      setBlockedReason(data.blockedReason ?? null);
      setOwnProjectIds(Array.isArray(data.ownProjectIds) ? data.ownProjectIds : []);
      setVotingStatus(data.votingStatus ?? "open");
      setVotingOpensAt(data.votingOpensAt ?? null);
      setVotingClosesAt(data.votingClosesAt ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasVoted = useCallback(
    (projectId: string) => userVotes.includes(projectId),
    [userVotes]
  );

  const isOwnProject = useCallback(
    (projectId: string) => ownProjectIds.includes(projectId),
    [ownProjectIds]
  );

  const getVoteCount = useCallback(
    (projectId: string) => voteCounts[projectId] || 0,
    [voteCounts]
  );

  const vote = useCallback(
    async (projectId: string): Promise<boolean> => {
      if (!eventId || !projectId) return false;
      if (hasVoted(projectId)) return false;

      if (isOwnProject(projectId)) {
        setError(OWN_PROJECT_VOTE_BLOCK_MESSAGE);
        return false;
      }

      if (!canVote) {
        setError(blockedReason || "You cannot vote in this event");
        return false;
      }

      if (remainingVotes <= 0) {
        setError(`You can only vote for ${maxVotes} projects`);
        return false;
      }

      try {
        const res = await fetch(`/api/events/${eventId}/votes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId }),
        });

        if (res.status === 401) {
          setError("Please sign in to vote");
          return false;
        }

        // Local vote state may be stale after a rejection, for example when
        // another card's vote took the last slot. refresh() clears the error,
        // so it has to finish before the rejection message is set.
        if (res.status === 403) {
          const data = await res.json();
          await refresh();
          setError(data.error || "You cannot vote in this event");
          return false;
        }

        if (!res.ok) {
          const data = await res.json();
          await refresh();
          setError(data.error || "Failed to cast vote");
          return false;
        }

        // cast_project_vote returns the authoritative remaining count; fall
        // back to a floored local decrement if the body lacks it.
        const serverRemaining = readRemainingVotes(await res.json().catch(() => null));

        // Optimistic update
        setUserVotes((prev) => [...prev, projectId]);
        setVoteCounts((prev) => ({
          ...prev,
          [projectId]: (prev[projectId] || 0) + 1,
        }));
        setRemainingVotes((prev) => serverRemaining ?? Math.max(0, prev - 1));
        setError(null);

        return true;
      } catch (err) {
        setError((err as Error).message);
        void refresh();
        return false;
      }
    },
    [eventId, hasVoted, isOwnProject, canVote, blockedReason, remainingVotes, maxVotes, refresh]
  );

  const unvote = useCallback(
    async (projectId: string): Promise<boolean> => {
      if (!eventId || !projectId) return false;
      if (!hasVoted(projectId)) return false;

      if (!canVote) {
        setError(blockedReason || "You cannot vote in this event");
        return false;
      }

      try {
        const res = await fetch(`/api/events/${eventId}/votes`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId }),
        });

        if (res.status === 401) {
          setError("Please sign in to manage votes");
          return false;
        }

        if (res.status === 403) {
          const data = await res.json();
          setError(data.error || "You cannot vote in this event");
          return false;
        }

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to remove vote");
          return false;
        }

        const serverRemaining = readRemainingVotes(await res.json().catch(() => null));

        // Optimistic update
        setUserVotes((prev) => prev.filter((id) => id !== projectId));
        setVoteCounts((prev) => ({
          ...prev,
          [projectId]: Math.max(0, (prev[projectId] || 1) - 1),
        }));
        setRemainingVotes((prev) => serverRemaining ?? Math.min(maxVotes, prev + 1));
        setError(null);

        return true;
      } catch (err) {
        setError((err as Error).message);
        void refresh();
        return false;
      }
    },
    [eventId, hasVoted, canVote, blockedReason, maxVotes, refresh]
  );

  const toggleVote = useCallback(
    async (projectId: string): Promise<boolean> => {
      if (hasVoted(projectId)) {
        return unvote(projectId);
      } else {
        return vote(projectId);
      }
    },
    [hasVoted, vote, unvote]
  );

  return {
    voteCounts,
    userVotes,
    remainingVotes,
    maxVotes,
    canVote,
    blockedReason,
    ownProjectIds,
    votingStatus,
    votingOpensAt,
    votingClosesAt,
    isLoading,
    error,
    hasVoted,
    isOwnProject,
    getVoteCount,
    vote,
    unvote,
    toggleVote,
    refresh,
  };
}
