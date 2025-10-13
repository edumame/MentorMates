"use client";

import { useCallback, useEffect, useState } from "react";

interface UseProjectLikeResult {
  liked: boolean;
  count: number;
  isLoading: boolean;
  error?: string | null;
  toggleLike: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useProjectLike(projectId: string): UseProjectLikeResult {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/like`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Failed to load like status");
      }
      const data = (await res.json()) as { liked: boolean; count: number };
      setLiked(Boolean(data.liked));
      setCount(Number(data.count || 0));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggleLike = useCallback(async () => {
    if (!projectId) return;
    try {
      const method = liked ? "DELETE" : "POST";
      const res = await fetch(`/api/projects/${projectId}/like`, { method });
      if (res.status === 401) {
        throw new Error("unauthorized");
      }
      if (!res.ok) {
        throw new Error("Failed to update like");
      }
      // Optimistic update then refresh to confirm
      setLiked((prev) => !prev);
      setCount((prev) => (liked ? Math.max(0, prev - 1) : prev + 1));
      // Optionally refresh to sync with server
      void refresh();
    } catch (err) {
      setError((err as Error).message);
      // best-effort to resync
      void refresh();
    }
  }, [liked, projectId, refresh]);

  return { liked, count, isLoading, error, toggleLike, refresh };
}
