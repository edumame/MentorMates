"use client";

/**
 * RoundsEditor — minimal organizer UI for multi-round judging (#706).
 *
 * Manages the `rounds` array and `activeRound` inside an event's
 * `scoring_config`. Organizers can add/remove rounds, rename them, pick the
 * active round, and choose which projects advance to the next round via
 * /api/events/[eventId]/rounds/advance.
 *
 * Designed as a drop-in panel inside the event-settings flow. Keeps its own
 * local state and persists on "Save".
 */

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, ArrowRightCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RoundScoringConfigDialog } from "@/components/events/round-scoring-config-dialog";
import { toast } from "@/lib/hooks/use-toast";
import {
  buildEventTrackScoringCriteriaFromConfig,
  stripRoundTrackOverrides,
} from "@/lib/judging/scoring-config";
import { supabase } from "@/lib/supabase";
import type {
  EventScoringConfig,
  RoundConfig,
  TrackScoringConfig,
} from "@/lib/types";

interface RoundsEditorProps {
  eventId: string;
  scoringConfig: EventScoringConfig;
  onSaved?: (next: EventScoringConfig) => void;
}

interface AdvancementCandidate {
  rank: number | null;
  projectId: string;
  projectName: string;
  leadName: string;
  score: number | null;
  judgeCount: number;
}

const DEFAULT_ROUND: RoundConfig = {
  round_number: 1,
  name: "Round 1",
  advancement_count: null,
};

export function RoundsEditor({
  eventId,
  scoringConfig,
  onSaved,
}: RoundsEditorProps) {
  const initialRounds = useMemo<RoundConfig[]>(
    () =>
      scoringConfig.rounds && scoringConfig.rounds.length > 0
        ? [...scoringConfig.rounds].sort(
            (a, b) => a.round_number - b.round_number
          )
        : [DEFAULT_ROUND],
    [scoringConfig.rounds]
  );
  const [rounds, setRounds] = useState<RoundConfig[]>(initialRounds);
  const [activeRound, setActiveRound] = useState<number>(
    scoringConfig.activeRound && scoringConfig.activeRound > 0
      ? scoringConfig.activeRound
      : 1
  );
  const [saving, setSaving] = useState(false);
  const [editingRoundNumber, setEditingRoundNumber] = useState<number | null>(
    null
  );
  const [advanceDialogOpen, setAdvanceDialogOpen] = useState(false);
  const [advanceDialogRound, setAdvanceDialogRound] = useState<number | null>(
    null
  );
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [savingSelection, setSavingSelection] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidates, setCandidates] = useState<AdvancementCandidate[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  useEffect(() => {
    setRounds(initialRounds);
    setActiveRound(
      scoringConfig.activeRound && scoringConfig.activeRound > 0
        ? scoringConfig.activeRound
        : 1
    );
  }, [initialRounds, scoringConfig.activeRound]);

  useEffect(() => {
    if (!advanceDialogOpen) {
      setCandidateSearch("");
    }
  }, [advanceDialogOpen]);

  const addRound = () => {
    const nextNumber =
      rounds.length > 0
        ? Math.max(...rounds.map((r) => r.round_number)) + 1
        : 1;
    setRounds((prev) => [
      ...prev,
      {
        round_number: nextNumber,
        name: `Round ${nextNumber}`,
        advancement_count: null,
      },
    ]);
  };

  const removeRound = (roundNumber: number) => {
    if (rounds.length <= 1) return;
    setRounds((prev) => prev.filter((r) => r.round_number !== roundNumber));
    if (activeRound === roundNumber) setActiveRound(1);
  };

  const updateRound = (roundNumber: number, patch: Partial<RoundConfig>) => {
    setRounds((prev) =>
      prev.map((r) =>
        r.round_number === roundNumber ? { ...r, ...patch } : r
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const sortedRounds = [...rounds].sort(
        (a, b) => a.round_number - b.round_number
      );
      const persistedRounds = stripRoundTrackOverrides(sortedRounds);

      const { data: trackRows, error: trackRowsError } = await supabase
        .from("event_tracks")
        .select("track_id")
        .eq("event_id", eventId);

      if (trackRowsError) throw trackRowsError;

      await Promise.all(
        (trackRows || []).map(async (trackRow) => {
          const trackConfig = scoringConfig.tracks[trackRow.track_id];
          if (!trackConfig) {
            return;
          }

          const nextScoringCriteria = buildEventTrackScoringCriteriaFromConfig({
            trackId: trackRow.track_id,
            trackConfig,
            rounds: sortedRounds,
          });

          const { error } = await supabase
            .from("event_tracks")
            .update({ scoring_criteria: nextScoringCriteria })
            .eq("track_id", trackRow.track_id);

          if (error) throw error;
        })
      );

      const next: EventScoringConfig = {
        ...scoringConfig,
        rounds: sortedRounds,
        activeRound,
      };
      const persistedNext: EventScoringConfig = {
        ...next,
        rounds: persistedRounds,
      };
      const { error } = await supabase
        .from("events")
        .update({ scoring_config: persistedNext })
        .eq("event_id", eventId);
      if (error) throw error;
      toast({ title: "Rounds saved" });
      onSaved?.(next);
    } catch (err) {
      console.error("Failed to save rounds", err);
      toast({
        title: "Error",
        description: "Could not save rounds configuration.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const openAdvanceDialog = async (fromRound: number) => {
    setAdvanceDialogRound(fromRound);
    setAdvanceDialogOpen(true);
    setLoadingCandidates(true);

    try {
      const res = await fetch(
        `/api/events/${eventId}/rounds/advance?fromRound=${fromRound}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load projects.");
      setCandidates(json.candidates || []);
      setSelectedProjectIds(json.selectedProjectIds || []);
    } catch (err) {
      console.error("Failed to load advancement candidates", err);
      setAdvanceDialogOpen(false);
      toast({
        title: "Error",
        description:
          err instanceof Error
            ? err.message
            : "Could not load projects for advancement.",
        variant: "destructive",
      });
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleAdvanceSelectionSave = async () => {
    if (!advanceDialogRound) return;

    setSavingSelection(true);
    try {
      const res = await fetch(`/api/events/${eventId}/rounds/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromRound: advanceDialogRound,
          projectIds: selectedProjectIds,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Advance failed");

      toast({
        title: `Saved ${json.advancedCount} project(s) for round ${json.toRound}`,
      });
      setAdvanceDialogOpen(false);
    } catch (err) {
      console.error("Advance selection save failed", err);
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Could not save round selection.",
        variant: "destructive",
      });
    } finally {
      setSavingSelection(false);
    }
  };

  const visibleCandidates = useMemo(() => {
    const query = candidateSearch.trim().toLowerCase();
    if (!query) return candidates;

    return candidates.filter((candidate) => {
      const haystack = `${candidate.projectName} ${candidate.leadName}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [candidateSearch, candidates]);

  const toggleProjectSelection = (
    projectId: string,
    checked: boolean | "indeterminate"
  ) => {
    setSelectedProjectIds((prev) => {
      if (checked) {
        return prev.includes(projectId) ? prev : [...prev, projectId];
      }
      return prev.filter((id) => id !== projectId);
    });
  };

  const selectAllVisible = () => {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev);
      visibleCandidates.forEach((candidate) => next.add(candidate.projectId));
      return Array.from(next);
    });
  };

  const clearVisible = () => {
    const visibleIds = new Set(visibleCandidates.map((candidate) => candidate.projectId));
    setSelectedProjectIds((prev) =>
      prev.filter((projectId) => !visibleIds.has(projectId))
    );
  };

  const editingRound =
    editingRoundNumber !== null
      ? rounds.find((round) => round.round_number === editingRoundNumber) || null
      : null;

  return (
    <Card className="w-full min-w-0 space-y-6 border p-4 shadow-none sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold">Judging Rounds</h3>
          <p className="text-sm text-muted-foreground">
            Configure multi-round judging and choose exactly which projects advance.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={addRound}
          size="sm"
          className="shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 mr-1" /> Add round
        </Button>
      </div>

      <div className="divide-y divide-border/60 rounded-lg bg-muted/30">
        {rounds.map((round) => {
          const isActive = activeRound === round.round_number;
          return (
            <div
              key={round.round_number}
              className="space-y-5 p-4 first:pt-4 last:pb-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <span className="text-sm font-medium shrink-0">
                  Round {round.round_number}
                </span>
                <Input
                  value={round.name}
                  onChange={(e) =>
                    updateRound(round.round_number, { name: e.target.value })
                  }
                  placeholder="Round name"
                  className="min-w-0 flex-1"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={isActive ? "default" : "outline"}
                    onClick={() => setActiveRound(round.round_number)}
                    className="whitespace-nowrap"
                  >
                    {isActive ? "Active" : "Set active"}
                  </Button>
                  {rounds.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeRound(round.round_number)}
                      aria-label="Remove round"
                      className="shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  Choose projects to advance
                </p>
                <div className="flex flex-col gap-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingRoundNumber(round.round_number)}
                    className="w-full sm:w-auto"
                  >
                    Edit rubric
                  </Button>
                  {round.tracks ? (
                    <span className="text-xs font-medium text-[#2E68CA]">
                      Custom round rubric
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Using event default rubric
                    </span>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openAdvanceDialog(round.round_number)}
                    className="w-full whitespace-normal sm:w-auto sm:whitespace-nowrap"
                  >
                    <ArrowRightCircle className="mr-1 h-4 w-4 shrink-0" />
                    Pick round {round.round_number + 1} projects
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 border-t border-border/60 pt-5 sm:flex-row sm:justify-end">
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto"
        >
          {saving ? "Saving..." : "Save rounds"}
        </Button>
      </div>

      <Dialog open={advanceDialogOpen} onOpenChange={setAdvanceDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Choose Projects For Round{" "}
              {advanceDialogRound ? advanceDialogRound + 1 : ""}
            </DialogTitle>
            <DialogDescription>
              Select the projects you want to advance from round{" "}
              {advanceDialogRound ?? "?"}. Existing selections are preloaded.
            </DialogDescription>
          </DialogHeader>

          {loadingCandidates ? (
            <div className="flex min-h-[240px] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Input
                  value={candidateSearch}
                  onChange={(e) => setCandidateSearch(e.target.value)}
                  placeholder="Search projects or leads"
                  className="sm:max-w-sm"
                />
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">
                    {selectedProjectIds.length} selected
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={selectAllVisible}
                  >
                    Select visible
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearVisible}
                  >
                    Clear visible
                  </Button>
                </div>
              </div>

              <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {visibleCandidates.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No projects match this search.
                  </div>
                ) : (
                  visibleCandidates.map((candidate) => {
                    const checked = selectedProjectIds.includes(candidate.projectId);

                    return (
                      <label
                        key={candidate.projectId}
                        className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) =>
                            toggleProjectSelection(candidate.projectId, value)
                          }
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">
                                {candidate.projectName || candidate.projectId}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {candidate.leadName || "No lead name"}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span>
                                Rank:{" "}
                                {candidate.rank !== null ? `#${candidate.rank}` : "Unranked"}
                              </span>
                              <span>
                                Score:{" "}
                                {candidate.score !== null
                                  ? candidate.score.toFixed(2)
                                  : "No scores"}
                              </span>
                              <span>Judges: {candidate.judgeCount}</span>
                            </div>
                          </div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAdvanceDialogOpen(false)}
              disabled={savingSelection}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAdvanceSelectionSave}
              disabled={loadingCandidates || savingSelection || !advanceDialogRound}
            >
              {savingSelection ? "Saving..." : "Save advancement selection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editingRound && (
        <RoundScoringConfigDialog
          open={editingRoundNumber !== null}
          onOpenChange={(open) => {
            if (!open) setEditingRoundNumber(null);
          }}
          roundNumber={editingRound.round_number}
          roundName={editingRound.name}
          baseTracks={scoringConfig.tracks}
          initialTracks={editingRound.tracks}
          onSave={(tracks: Record<string, TrackScoringConfig>) => {
            updateRound(editingRound.round_number, {
              tracks,
            });
            setEditingRoundNumber(null);
          }}
          onResetToDefault={() => {
            updateRound(editingRound.round_number, {
              tracks: undefined,
            });
            setEditingRoundNumber(null);
          }}
        />
      )}
    </Card>
  );
}
