"use client";

import { useCallback, useEffect, useState } from "react";

interface UseEventVotesResult {
  // Vote counts per project: { projectId: count }
  voteCounts: Record<string, number>;
  // Project IDs that current user has voted for
  userVotes: string[];
  // Number of votes remaining for user
  remainingVotes: number;
  // Maximum votes allowed per user
  maxVotes: number;
  // Loading state
  isLoading: boolean;
  // Error message
  error: string | null;
  // Check if user has voted for a specific project
  hasVoted: (projectId: string) => boolean;
  // Get vote count for a specific project
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

export function useEventVotes(eventId: string): UseEventVotesResult {
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [userVotes, setUserVotes] = useState<string[]>([]);
  const [remainingVotes, setRemainingVotes] = useState(0);
  const [maxVotes, setMaxVotes] = useState(3);
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

  const getVoteCount = useCallback(
    (projectId: string) => voteCounts[projectId] || 0,
    [voteCounts]
  );

  const vote = useCallback(
    async (projectId: string): Promise<boolean> => {
      if (!eventId || !projectId) return false;
      if (hasVoted(projectId)) return false;
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

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to cast vote");
          return false;
        }

        // Optimistic update
        setUserVotes((prev) => [...prev, projectId]);
        setVoteCounts((prev) => ({
          ...prev,
          [projectId]: (prev[projectId] || 0) + 1,
        }));
        setRemainingVotes((prev) => prev - 1);
        setError(null);

        return true;
      } catch (err) {
        setError((err as Error).message);
        void refresh();
        return false;
      }
    },
    [eventId, hasVoted, remainingVotes, maxVotes, refresh]
  );

  const unvote = useCallback(
    async (projectId: string): Promise<boolean> => {
      if (!eventId || !projectId) return false;
      if (!hasVoted(projectId)) return false;

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

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to remove vote");
          return false;
        }

        // Optimistic update
        setUserVotes((prev) => prev.filter((id) => id !== projectId));
        setVoteCounts((prev) => ({
          ...prev,
          [projectId]: Math.max(0, (prev[projectId] || 1) - 1),
        }));
        setRemainingVotes((prev) => prev + 1);
        setError(null);

        return true;
      } catch (err) {
        setError((err as Error).message);
        void refresh();
        return false;
      }
    },
    [eventId, hasVoted, refresh]
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
    isLoading,
    error,
    hasVoted,
    getVoteCount,
    vote,
    unvote,
    toggleVote,
    refresh,
  };
}
