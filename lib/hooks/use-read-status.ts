"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Hook to persist a simple read/unread flag in localStorage for any entity.
 * Caller passes a unique storage key, e.g. `feedback:<feedbackId>`.
 */
export function useReadStatus(storageKey: string) {
  const [isRead, setIsRead] = useState<boolean>(false);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const stored = window.localStorage.getItem(`read-status:${storageKey}`);
      setIsRead(stored === "1");
    } catch {
      // ignore localStorage access issues
    }
  }, [storageKey]);

  const markAsRead = useCallback(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(`read-status:${storageKey}`, "1");
      }
    } catch {
      // ignore localStorage access issues
    }
    setIsRead(true);
  }, [storageKey]);

  const resetRead = useCallback(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(`read-status:${storageKey}`);
      }
    } catch {
      // ignore localStorage access issues
    }
    setIsRead(false);
  }, [storageKey]);

  return { isRead, markAsRead, resetRead } as const;
}
