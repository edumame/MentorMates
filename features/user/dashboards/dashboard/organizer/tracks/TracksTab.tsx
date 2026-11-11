"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CompactScoringForm,
  type TrackDetailsById,
} from "@/features/user/dashboards/dashboard/organizer/tracks/CompactScoringForm";
import { JudgingSidebar } from "@/features/user/dashboards/dashboard/organizer/tracks/JudgingSidebar";
import { buildEventTrackScoringCriteriaFromConfig } from "@/lib/judging/scoring-config";
import {
  classifyTrackEntries,
  rekeyTrackDescriptions,
  withFreshTrackIds,
  withoutTrack,
  withUuidTrackIds,
} from "./classify-track-entries";
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
const POSTGRES_UNIQUE_VIOLATION = "23505";

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

  // Saving can re-key tracks (#895: client UUIDs become track_id). The draft
  // must adopt those keys, or the next save would insert the tracks again.
  const adoptSavedConfig = (config: EventScoringConfig) => {
    setScoringConfig(config);
    setEditedConfig(config);
  };

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

  // Returns the insert's error so the caller can recover from an id collision.
  const writeTracks = async (
    config: EventScoringConfig,
    savedTrackIds: Set<string>,
    details?: TrackDetailsById,
  ) => {
    const savedDescriptions = new Map(
      tracks.map((t) => [t.track_id, t.description ?? ""])
    );
    const { existing, newTracks } = classifyTrackEntries(
      Object.keys(config.tracks),
      savedTrackIds,
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

    // Upsert existing tracks (UUIDs already in DB)
    if (existing.length > 0) {
      const { error: upsertError } = await supabase
        .from("event_tracks")
        .upsert(existing, { onConflict: "track_id", ignoreDuplicates: false });
      if (upsertError) throw upsertError;
    }

    // Insert, not upsert: new ids come from the client, so a collision must
    // fail rather than overwrite a row.
    if (newTracks.length === 0) return null;
    const { error: insertError } = await supabase
      .from("event_tracks")
      .insert(newTracks);
    return insertError;
  };

  // A collision has two causes. `tracks` can be stale, so the row is this
  // event's and needs an update; re-keying it would duplicate the track. Or the
  // id is another event's, which RLS may hide, so anything not found here gets
  // a fresh id. The insert is atomic, so none of these ids has a row of ours.
  const resolveTrackIdCollision = async (
    config: EventScoringConfig,
    savedTrackIds: Set<string>,
  ) => {
    const unsavedTrackIds = Object.keys(config.tracks).filter(
      (trackId) => !savedTrackIds.has(trackId),
    );
    const { data: ownRows, error } = await supabase
      .from("event_tracks")
      .select("track_id")
      .eq("event_id", eventId)
      .in("track_id", unsavedTrackIds);
    if (error) throw error;

    const ownTrackIds = new Set((ownRows ?? []).map((row) => row.track_id));
    return {
      config: withFreshTrackIds(
        config,
        unsavedTrackIds.filter((trackId) => !ownTrackIds.has(trackId)),
      ),
      savedTrackIds: new Set([...savedTrackIds, ...ownTrackIds]),
    };
  };

  const handleScoreUpdate = async (
    submittedConfig: EventScoringConfig,
    details?: TrackDetailsById
  ) => {
    try {
      setSaving(true);
      const config = withUuidTrackIds(submittedConfig);
      adoptSavedConfig(config);
      let trackDetails = rekeyTrackDescriptions(details, submittedConfig, config);

      const savedTrackIds = new Set(tracks.map((t) => t.track_id));
      let insertError = await writeTracks(config, savedTrackIds, trackDetails);
      if (insertError?.code === POSTGRES_UNIQUE_VIOLATION) {
        const resolved = await resolveTrackIdCollision(config, savedTrackIds);
        adoptSavedConfig(resolved.config);
        trackDetails = rekeyTrackDescriptions(trackDetails, config, resolved.config);
        insertError = await writeTracks(
          resolved.config,
          resolved.savedTrackIds,
          trackDetails,
        );
      }
      if (insertError) throw insertError;

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

  // Everything that outlives the form must forget the track, or a remount and
  // the next save would bring it back.
  const handleTrackDeleted = (trackId: string) => {
    const isOtherTrack = (track: EventTrack) => track.track_id !== trackId;
    setTracks((prev) => prev.filter(isOtherTrack));
    setEvent(
      (prev) =>
        prev && {
          ...prev,
          event_tracks: prev.event_tracks?.filter(isOtherTrack),
        },
    );
    setScoringConfig((prev) => prev && withoutTrack(prev, trackId));
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
                isArchived={isArchived}
                eventId={eventId}
                tracks={tracks}
                onTrackDeleted={handleTrackDeleted}
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
