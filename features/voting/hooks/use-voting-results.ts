"use client";

import { useCallback, useEffect, useState } from "react";

export interface VotingResult {
  projectId: string;
  projectName: string;
  leadName: string;
  coverImageUrl: string | null;
  voteCount: number;
  voters: string[];
}

interface UseVotingResultsResult {
  results: VotingResult[];
  totalVotes: number;
  totalVoters: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useVotingResults(eventId: string): UseVotingResultsResult {
  const [results, setResults] = useState<VotingResult[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [totalVoters, setTotalVoters] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!eventId) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/events/${eventId}/votes/results`, {
        cache: "no-store",
      });

      if (res.status === 403) {
        setError("Only organizers can view voting results");
        setIsLoading(false);
        return;
      }

      if (res.status === 401) {
        setError("Please sign in to view results");
        setIsLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to load voting results");
      }

      const data = await res.json();
      setResults(data.results || []);
      setTotalVotes(data.totalVotes || 0);
      setTotalVoters(data.totalVoters || 0);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    results,
    totalVotes,
    totalVoters,
    isLoading,
    error,
    refresh,
  };
}
