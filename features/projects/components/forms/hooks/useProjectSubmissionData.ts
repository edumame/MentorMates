import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Track {
  id: string;
  name: string;
}

export function useProjectSubmissionData(eventId?: string) {
  const [allUsers, setAllUsers] = useState<string[]>([]);
  const [availableTracks, setAvailableTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // If no event provided, return empty data for eventless flow
        if (!eventId) {
          setAllUsers([]);
          setAvailableTracks([]);
          return;
        }
        setAllUsers([]);

        // Fetch event tracks
        const { data: trackData, error: trackError } = await supabase
          .from("event_tracks")
          .select("track_id, name")
          .eq("event_id", eventId);

        if (trackError) {
          console.error("Error fetching event tracks:", trackError);
        } else if (trackData) {
          const tracks = trackData.map((track) => ({
            id: track.track_id,
            name: track.name,
          }));
          setAvailableTracks(tracks);
        }
      } catch (err) {
        console.error("Unexpected error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [eventId]);

  return { allUsers, availableTracks, isLoading };
}
