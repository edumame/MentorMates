"use client";

import { useState, useEffect, useCallback } from "react";
import { CompactScoringForm } from "@/features/user/dashboards/dashboard/organizer/tracks/CompactScoringForm";
import { JudgingSidebar } from "@/features/user/dashboards/dashboard/organizer/tracks/JudgingSidebar";
import { buildEventTrackScoringCriteriaFromConfig } from "@/lib/judging/scoring-config";
import { classifyTrackEntries } from "./classify-track-entries";
import { EventDetails, EventScoringConfig, EventTrack } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { Pencil, Eye, Scale, Download } from "lucide-react";
import { JudgePreviewDeck } from "./JudgePreviewDeck";

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
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [tracks, setTracks] = useState<EventTrack[]>([]);

  const fetchTracks = useCallback(async () => {
    const { data, error } = await supabase
      .from("event_tracks")
      .select("*")
      .eq("event_id", eventId);

    if (error) {
      console.error("Error fetching tracks:", error);
      toast({
        title: "Error",
        description: "Failed to load track data",
        variant: "destructive",
      });
    } else {
      setTracks(data || []);
    }
  }, [eventId, toast]);

  useEffect(() => {
    fetchTracks();
  }, [eventId, toast, fetchTracks]);

  const handleScoreUpdate = async (config: EventScoringConfig) => {
    try {
      setSaving(true);
      setScoringConfig(config);

      const existingDbTrackIds = new Set(tracks.map((t) => t.track_id));
      const { existing, newTracks } = classifyTrackEntries(
        Object.keys(config.tracks),
        existingDbTrackIds,
        eventId,
        (trackId) => ({
          name: config.tracks[trackId].name,
          description: config.tracks[trackId].name,
          scoring_criteria: buildEventTrackScoringCriteriaFromConfig({
            trackId,
            trackConfig: config.tracks[trackId],
            rounds: config.rounds,
          }),
        }),
      );

      // Upsert existing tracks (real UUIDs already in DB)
      if (existing.length > 0) {
        const { error: upsertError } = await supabase
          .from("event_tracks")
          .upsert(existing, { onConflict: "track_id", ignoreDuplicates: false });
        if (upsertError) throw upsertError;
      }

      // Insert new tracks — omit track_id so Postgres gen_random_uuid() fills it
      if (newTracks.length > 0) {
        const { error: insertError } = await supabase
          .from("event_tracks")
          .insert(newTracks);
        if (insertError) throw insertError;
      }

      if (error) throw error;

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
        setTracks(updatedTracks);
        setEvent({ ...event, event_tracks: updatedTracks });
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
    <div className="space-y-6 w-full">
      {/* Top bar: title + Edit/Preview toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Tracks &amp; Judging
        </h2>
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          <button
            type="button"
            onClick={() => setMode("edit")}
            className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
              mode === "edit"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => setMode("preview")}
            className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
              mode === "preview"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </button>
        </div>
      </div>

      {mode === "preview" ? (
        <JudgePreviewDeck
          scoringConfig={scoringConfig}
          onClose={() => setMode("edit")}
        />
      ) : (
        <div className="flex gap-6 items-start">
          {/* Left: Track editor */}
          <div className="flex-1 min-w-0">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
              {/* Header */}
              <div className="space-y-1 mb-5">
                <h2 className="text-xl font-bold text-black tracking-tight">
                  Tracks &amp; Judging Criteria
                </h2>
                <p className="text-sm text-gray-600">
                  Define competition tracks, scoring criteria, and prizes. Click
                  any criterion to edit it, or use + buttons to add new ones.
                </p>
              </div>

              {/* Inline help banners */}
              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
                  <Scale className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-blue-900">
                    Each criterion has a{" "}
                    <strong className="font-semibold">weight</strong> for
                    relative importance and a{" "}
                    <strong className="font-semibold">score range</strong>{" "}
                    (min-max). Scores are weighted to produce a final ranking
                    per track.
                  </p>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
                  <Download className="h-5 w-5 text-gray-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-gray-700">
                    After judging, you can{" "}
                    <strong className="font-semibold">
                      export all scores as CSV
                    </strong>{" "}
                    from the organizer dashboard.
                  </p>
                </div>
              </div>

              {/* Compact scoring form */}
              <CompactScoringForm
                initialConfig={scoringConfig}
                isSubmitting={saving}
                onSave={handleScoreUpdate}
                isArchived={isArchived}
                eventId={eventId}
                tracks={tracks}
              />
            </div>
          </div>

          {/* Right: Judging sidebar (upload + AI chat) */}
          <JudgingSidebar
            config={
              scoringConfig || {
                tracks: {},
                defaultMin: 0,
                defaultMax: 10,
                defaultWeight: 1,
              }
            }
            onConfigChange={(newConfig) => setScoringConfig(newConfig)}
            eventId={eventId}
          />
        </div>
      )}
    </div>
  );
}
