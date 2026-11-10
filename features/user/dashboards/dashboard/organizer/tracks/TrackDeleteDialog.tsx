"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Confirmation for deleting a track (ORG-021 / JUDGE-005). Deleting an
 * event_tracks row cascades to project_scores, project_tracks and prizes, so
 * the dialog shows what will be lost and, once judges have scored the track,
 * requires typing the track name.
 */

export interface TrackDeleteImpact {
  scores: number;
  projects: number;
  prizes: number;
}

async function countRows(table: "project_scores" | "project_tracks" | "prizes", trackId: string) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("track_id", trackId);
  if (error) throw error;
  return count ?? 0;
}

export async function loadTrackDeleteImpact(trackId: string): Promise<TrackDeleteImpact> {
  const [scores, projects, prizes] = await Promise.all([
    countRows("project_scores", trackId),
    countRows("project_tracks", trackId),
    countRows("prizes", trackId),
  ]);
  return { scores, projects, prizes };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

interface TrackDeleteDialogProps {
  track: { id: string; name: string } | null;
  onCancel: () => void;
  onConfirm: (trackId: string) => void | Promise<void>;
}

export function TrackDeleteDialog({ track, onCancel, onConfirm }: TrackDeleteDialogProps) {
  const [impact, setImpact] = useState<TrackDeleteImpact | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    setImpact(null);
    setLoadFailed(false);
    setConfirmText("");
    if (!track) return;
    let active = true;
    loadTrackDeleteImpact(track.id)
      .then((result) => {
        if (active) setImpact(result);
      })
      .catch((error) => {
        console.error("Error loading track delete impact:", error);
        if (active) setLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, [track]);

  const trackName = track?.name.trim() || "Untitled Track";
  // When counts cannot be loaded, assume the worst and require the typed name.
  const requiresTypedName = loadFailed || (impact?.scores ?? 0) > 0;
  const canConfirm =
    !!track &&
    (impact !== null || loadFailed) &&
    (!requiresTypedName || confirmText.trim() === trackName);

  return (
    <AlertDialog open={!!track} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete track &ldquo;{trackName}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              {impact ? (
                <p>
                  This permanently deletes the track together with{" "}
                  {plural(impact.scores, "judge score", "judge scores")},{" "}
                  {plural(impact.prizes, "prize", "prizes")} and the track entries of{" "}
                  {plural(impact.projects, "project", "projects")} (the projects themselves are
                  kept). This cannot be undone.
                </p>
              ) : loadFailed ? (
                <p>
                  We couldn&apos;t check how many scores and prizes belong to this track. Deleting
                  it permanently removes all of its judge scores, prizes and project entries.
                </p>
              ) : (
                <p>Checking scores, prizes and entries for this track…</p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {requiresTypedName ? (
          <div className="space-y-2">
            <label htmlFor="delete-track-confirm" className="text-sm font-medium text-black">
              Judges have already scored this track. Type{" "}
              <span className="font-semibold">{trackName}</span> to confirm
            </label>
            <Input
              id="delete-track-confirm"
              autoComplete="off"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700 text-white"
            disabled={!canConfirm}
            onClick={() => {
              if (track && canConfirm) void onConfirm(track.id);
            }}
          >
            Delete track
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
