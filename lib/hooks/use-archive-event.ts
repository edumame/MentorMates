import { useState } from "react";
import { EventVisibility } from "@/lib/types";

interface UseArchiveEventResult {
  isLoading: boolean;
  error: string | null;
  archiveEvent: (eventId: string) => Promise<boolean>;
  unarchiveEvent: (eventId: string) => Promise<boolean>;
}

export function useArchiveEvent(): UseArchiveEventResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleArchiveAction = async (
    eventId: string,
    action: "archive" | "unarchive"
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/events/${eventId}/archive`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action} event`);
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to ${action} event`;
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const archiveEvent = (eventId: string) => handleArchiveAction(eventId, "archive");
  const unarchiveEvent = (eventId: string) => handleArchiveAction(eventId, "unarchive");

  return {
    isLoading,
    error,
    archiveEvent,
    unarchiveEvent,
  };
}