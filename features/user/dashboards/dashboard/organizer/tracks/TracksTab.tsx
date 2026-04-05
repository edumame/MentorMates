"use client";

import { ScoringConfigForm } from "@/features/user/dashboards/dashboard/organizer/tracks/scoring-config-form";
import { EventDetails, EventScoringConfig, EventTrack } from "@/lib/types";
import { supabase } from "@/lib/supabase";

interface TracksTabProps {
  eventId: string;
  event: EventDetails;
  setEvent: React.Dispatch<React.SetStateAction<EventDetails | null>>;
  scoringConfig: EventScoringConfig | null;
  setScoringConfig: React.Dispatch<
    React.SetStateAction<EventScoringConfig | null>
  >;
  saving: boolean;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  toast: (props: {
    title: string;
    description: string;
    variant?: "default" | "destructive";
  }) => void;
  isArchived: boolean;
}

export function TracksTab({
  eventId,
  event,
  setEvent,
  scoringConfig,
  setScoringConfig,
  saving,
  setSaving,
  toast,
  isArchived,
}: TracksTabProps) {
  const handleScoreUpdate = async (config: EventScoringConfig) => {
    try {
      setSaving(true);

      // Store the updated config in state
      setScoringConfig(config);

      const tracksToUpsert = Object.entries(config.tracks).map(
        ([trackId, trackConfig]) => {
          return {
            track_id: trackId,
            event_id: eventId,
            name: trackConfig.name,
            description: trackConfig.name, // Default description is same as name
            scoring_criteria: {
              name: trackConfig.name,
              criteria: trackConfig.criteria,
            },
          };
        }
      );

      // Perform upsert on all tracks at once
      const { error } = await supabase
        .from("event_tracks")
        .upsert(tracksToUpsert, {
          onConflict: "track_id",
          ignoreDuplicates: false,
        });

      if (error) throw error;

      // Refresh the tracks data
      const { data: refreshedTracks } = await supabase
        .from("event_tracks")
        .select(
          `
          *,
          prizes (
            id,
            prize_amount,
            prize_description
          )
        `
        )
        .eq("event_id", eventId);

      if (refreshedTracks && event) {
        const updatedTracks = refreshedTracks as unknown as EventTrack[];
        const updatedEvent = {
          ...event,
          event_tracks: updatedTracks,
        };
        setEvent(updatedEvent);
      }

      toast({
        title: "Success",
        description: "Scoring configuration saved successfully",
      });
    } catch (error) {
      console.error("Error saving scoring config:", error);
      toast({
        title: "Error",
        description: "Failed to save scoring configuration",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <div className="space-y-1">
          <h2
            className="font-geist font-semibold leading-[140%] tracking-[-1.32px] text-[var(--Color-Scheme-1-Text,#000)]"
            style={{ fontSize: "var(--Text-Sizes-Heading-6, 22px)" }}
          >
            Tracks &amp; Scoring
          </h2>
          <p className="text-sm text-gray-600">
            Configure your event tracks below. For each track, you can set up
            scoring criteria.
          </p>
        </div>

        <div className="mt-5">
          <ScoringConfigForm
            initialConfig={scoringConfig}
            isSubmitting={saving}
            onSave={handleScoreUpdate}
            isArchived={isArchived}
            eventId={eventId}
            tracks={event.event_tracks || []}
          />
        </div>
      </div>
    </div>
  );
}
