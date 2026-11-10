"use client";

import { useEffect, useState } from "react";
import { fetchEventTracks } from "@/features/projects/client-actions/client-track-update";

/** Both detail routes expose Tracks only after the same successful availability check. */
export function useProjectEventTracks(eventId: string | null | undefined) {
  const [hasTracks, setHasTracks] = useState(false);
  useEffect(() => {
    let current = true;
    setHasTracks(false);
    if (eventId) {
      void fetchEventTracks(eventId).then(({ data, error }) => {
        if (current) setHasTracks(!error && Boolean(data?.length));
      }).catch(() => { if (current) setHasTracks(false); });
    }
    return () => { current = false; };
  }, [eventId]);
  return hasTracks;
}
