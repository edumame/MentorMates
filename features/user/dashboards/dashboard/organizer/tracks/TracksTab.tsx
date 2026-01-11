"use client";

import { useState, useEffect, useCallback } from "react";
import { ScoringConfigForm } from "@/features/user/dashboards/dashboard/organizer/tracks/scoring-config-form";
import { EventDetails, EventScoringConfig, EventTrack } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { ListChecks } from "lucide-react";

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
  const [tracks, setTracks] = useState<EventTrack[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string>("");
  const [assigningAll, setAssigningAll] = useState(false);

  // Function to fetch tracks data
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
        setTracks(updatedTracks);

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

  const handleAssignAllProjects = async () => {
    if (!selectedTrackId) return;

    try {
      setAssigningAll(true);

      // Get all submitted projects for this event
      const { data: projects, error: projectsError } = await supabase
        .from("projects")
        .select("id")
        .eq("event_id", eventId)
        .eq("submitted", true);

      if (projectsError) throw projectsError;

      if (!projects || projects.length === 0) {
        toast({
          title: "No projects found",
          description: "There are no submitted projects to assign to this track",
          variant: "destructive",
        });
        return;
      }

      // Delete existing track assignments for these projects
      const projectIds = projects.map((p) => p.id);
      const { error: deleteError } = await supabase
        .from("project_tracks")
        .delete()
        .in("project_id", projectIds);

      if (deleteError) throw deleteError;

      // Create new track assignments
      const trackAssignments = projectIds.map((projectId) => ({
        project_id: projectId,
        track_id: selectedTrackId,
      }));

      const { error: insertError } = await supabase
        .from("project_tracks")
        .insert(trackAssignments);

      if (insertError) throw insertError;

      toast({
        title: "Success",
        description: `Assigned ${projects.length} project(s) to the selected track`,
      });

      setSelectedTrackId("");
    } catch (error) {
      console.error("Error assigning projects to track:", error);
      toast({
        title: "Error",
        description: "Failed to assign projects to track",
        variant: "destructive",
      });
    } finally {
      setAssigningAll(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground mb-6">
        Configure your event tracks below. For each track, you can set up
        scoring criteria.
      </p>

      {/* Bulk Track Assignment Section */}
      {tracks.length > 0 && (
        <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Bulk Track Assignment
          </h3>
          <p className="text-sm text-muted-foreground">
            Assign all submitted projects to a specific track. This will replace
            any existing track assignments.
          </p>
          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Select Track</label>
              <Select
                value={selectedTrackId}
                onValueChange={setSelectedTrackId}
                disabled={isArchived}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a track..." />
                </SelectTrigger>
                <SelectContent>
                  {tracks.map((track) => (
                    <SelectItem key={track.track_id} value={track.track_id}>
                      {track.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={!selectedTrackId || assigningAll || isArchived}
                  className="whitespace-nowrap"
                >
                  {assigningAll ? "Assigning..." : "Assign All Projects"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm bulk track assignment</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will assign all submitted projects to the selected track
                    and remove any existing track assignments. This action cannot be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleAssignAllProjects}>
                    Confirm Assignment
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}

      <ScoringConfigForm
        initialConfig={scoringConfig}
        isSubmitting={saving}
        onSave={handleScoreUpdate}
        tracks={tracks}
        isArchived={isArchived}
      />
    </div>
  );
}
