"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CompactScoringForm,
  type TrackDetailsById,
} from "@/features/user/dashboards/dashboard/organizer/tracks/CompactScoringForm";
import { JudgingSidebar } from "@/features/user/dashboards/dashboard/organizer/tracks/JudgingSidebar";
import { buildEventTrackScoringCriteriaFromConfig } from "@/lib/judging/scoring-config";
import { classifyTrackEntries } from "./classify-track-entries";
import { removeTrackFromConfig } from "./track-draft";
import { EventDetails, EventScoringConfig, EventTrack } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { Pencil, Eye, Scale, Download } from "lucide-react";
import { JudgePreviewDeck } from "./JudgePreviewDeck";

const EMPTY_SCORING_CONFIG: EventScoringConfig = {
  tracks: {},
  defaultMin: 0,
  defaultMax: 10,
  defaultWeight: 1,
};

const TRACKS_WITH_PRIZES_SELECT = `
  *,
  prizes (
    id,
    prize_amount,
    prize_description
  )
`;

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

  // Unsaved edits, shared by the form and the sidebar. Kept apart from
  // scoringConfig because the scores tab reads that as the saved config.
  // Null until the first edit, so the saved config shows once it has loaded.
  const [editedConfig, setEditedConfig] = useState<EventScoringConfig | null>(
    null
  );
  const savedConfig = scoringConfig ?? EMPTY_SCORING_CONFIG;
  const draftConfig = editedConfig ?? savedConfig;

  const updateDraftConfig = useCallback(
    (update: React.SetStateAction<EventScoringConfig>) => {
      setEditedConfig((prev) => {
        const current = prev ?? savedConfig;
        return typeof update === "function" ? update(current) : update;
      });
    },
    [savedConfig]
  );

  // The row is already gone, so the saved state must stop listing it too.
  const handleTrackDeleted = useCallback(
    (trackId: string) => {
      setTracks((prev) => prev.filter((track) => track.track_id !== trackId));
      setScoringConfig((prev) =>
        prev ? removeTrackFromConfig(prev, trackId) : prev
      );
    },
    [setScoringConfig]
  );

  const fetchTracks = useCallback(async () => {
    // Include prizes so the track cards can list them (JUDGE-018).
    const { data, error } = await supabase
      .from("event_tracks")
      .select(TRACKS_WITH_PRIZES_SELECT)
      .eq("event_id", eventId);

    if (error) {
      console.error("Error fetching tracks:", error);
      toast({
        title: "Error",
        description: "Failed to load track data",
        variant: "destructive",
      });
    } else {
      setTracks((data || []) as unknown as EventTrack[]);
    }
  }, [eventId, toast]);

  useEffect(() => {
    fetchTracks();
  }, [eventId, toast, fetchTracks]);

  const handleScoreUpdate = async (
    config: EventScoringConfig,
    details?: TrackDetailsById
  ) => {
    try {
      setSaving(true);
      setScoringConfig(config);

      const existingDbTrackIds = new Set(tracks.map((t) => t.track_id));
      const savedDescriptions = new Map(
        tracks.map((t) => [t.track_id, t.description ?? ""])
      );
      const { existing, newTracks } = classifyTrackEntries(
        Object.keys(config.tracks),
        existingDbTrackIds,
        eventId,
        (trackId) => ({
          name: config.tracks[trackId].name,
          // JUDGE-006: never derive the description from the name; keep the
          // edited value, else the stored one.
          description:
            details?.descriptions[trackId] ??
            savedDescriptions.get(trackId) ??
            "",
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

      const { data: refreshedTracks } = await supabase
        .from("event_tracks")
        .select(TRACKS_WITH_PRIZES_SELECT)
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-gray-900 min-w-0">
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
          scoringConfig={draftConfig}
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
                config={draftConfig}
                onConfigChange={updateDraftConfig}
                isSubmitting={saving}
                onSave={handleScoreUpdate}
                onTrackDeleted={handleTrackDeleted}
                isArchived={isArchived}
                eventId={eventId}
                tracks={tracks}
              />
            </div>
          </div>

          {/* Right: Judging sidebar (upload + AI chat) */}
          <JudgingSidebar
            config={draftConfig}
            onConfigChange={updateDraftConfig}
            eventId={eventId}
          />
        </div>
      )}
    </div>
  );
}
