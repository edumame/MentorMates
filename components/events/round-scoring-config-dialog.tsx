"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ScoringCriterion, TrackScoringConfig } from "@/lib/types";

interface RoundScoringConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roundNumber: number;
  roundName: string;
  baseTracks: Record<string, TrackScoringConfig>;
  initialTracks?: Record<string, TrackScoringConfig>;
  onSave: (tracks: Record<string, TrackScoringConfig>) => void;
  onResetToDefault: () => void;
}

function cloneTracks(
  tracks: Record<string, TrackScoringConfig>
): Record<string, TrackScoringConfig> {
  return Object.fromEntries(
    Object.entries(tracks).map(([trackId, track]) => [
      trackId,
      {
        name: track.name,
        criteria: track.criteria.map((criterion) => ({ ...criterion })),
      },
    ])
  );
}

function sanitizeCriterion(criterion: ScoringCriterion): ScoringCriterion {
  if (criterion.type === "multiplechoice") {
    return {
      ...criterion,
      min: undefined,
      max: undefined,
      weight: undefined,
      options:
        criterion.options && criterion.options.length > 0
          ? criterion.options
          : ["Option 1", "Option 2"],
    };
  }

  return {
    ...criterion,
    min: criterion.min ?? 1,
    max: criterion.max ?? 10,
    weight: criterion.weight ?? 1,
    options: undefined,
  };
}

export function RoundScoringConfigDialog({
  open,
  onOpenChange,
  roundNumber,
  roundName,
  baseTracks,
  initialTracks,
  onSave,
  onResetToDefault,
}: RoundScoringConfigDialogProps) {
  const [tracks, setTracks] = useState<Record<string, TrackScoringConfig>>(
    cloneTracks(initialTracks || baseTracks)
  );

  useEffect(() => {
    if (!open) return;
    setTracks(cloneTracks(initialTracks || baseTracks));
  }, [open, initialTracks, baseTracks]);

  const trackEntries = useMemo(() => Object.entries(tracks), [tracks]);

  const updateCriterion = (
    trackId: string,
    criterionIndex: number,
    updates: Partial<ScoringCriterion>
  ) => {
    setTracks((prev) => ({
      ...prev,
      [trackId]: {
        ...prev[trackId],
        criteria: prev[trackId].criteria.map((criterion, index) =>
          index === criterionIndex
            ? sanitizeCriterion({ ...criterion, ...updates })
            : criterion
        ),
      },
    }));
  };

  const addCriterion = (trackId: string) => {
    setTracks((prev) => ({
      ...prev,
      [trackId]: {
        ...prev[trackId],
        criteria: [
          ...prev[trackId].criteria,
          sanitizeCriterion({
            id: `criterion_${Date.now()}`,
            name: "",
            description: "",
            type: "numeric",
            weight: 1,
            min: 1,
            max: 10,
          }),
        ],
      },
    }));
  };

  const removeCriterion = (trackId: string, criterionIndex: number) => {
    setTracks((prev) => ({
      ...prev,
      [trackId]: {
        ...prev[trackId],
        criteria: prev[trackId].criteria.filter(
          (_, index) => index !== criterionIndex
        ),
      },
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            Round {roundNumber} Rubric: {roundName || `Round ${roundNumber}`}
          </DialogTitle>
          <DialogDescription>
            Customize the track criteria judges should use for this round. If
            you reset, this round falls back to the event&apos;s default track
            scoring config.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[68vh] space-y-4 overflow-y-auto pr-1">
          {trackEntries.map(([trackId, track]) => (
            <Card key={trackId} className="space-y-4 p-4">
              <div>
                <h4 className="text-sm font-semibold">{track.name}</h4>
                <p className="text-xs text-muted-foreground">
                  {track.criteria.length} criterion
                  {track.criteria.length === 1 ? "" : "a"}
                </p>
              </div>

              <div className="space-y-3">
                {track.criteria.map((criterion, index) => (
                  <div
                    key={`${trackId}-${criterion.id}-${index}`}
                    className="rounded-lg border p-3"
                  >
                    <div className="grid gap-3 md:grid-cols-[1.4fr_180px]">
                      <div className="space-y-1">
                        <Label>Criterion Name</Label>
                        <Input
                          value={criterion.name}
                          onChange={(e) =>
                            updateCriterion(trackId, index, {
                              name: e.target.value,
                            })
                          }
                          placeholder="e.g. Technical Execution"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Type</Label>
                        <Select
                          value={criterion.type || "numeric"}
                          onValueChange={(value) =>
                            updateCriterion(trackId, index, {
                              type: value as "numeric" | "multiplechoice",
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="numeric">Numeric</SelectItem>
                            <SelectItem value="multiplechoice">
                              Multiple Choice
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1">
                      <Label>Description</Label>
                      <Input
                        value={criterion.description}
                        onChange={(e) =>
                          updateCriterion(trackId, index, {
                            description: e.target.value,
                          })
                        }
                        placeholder="What should judges evaluate?"
                      />
                    </div>

                    {criterion.type === "multiplechoice" ? (
                      <div className="mt-3 space-y-1">
                        <Label>Options</Label>
                        <Input
                          value={(criterion.options || []).join(", ")}
                          onChange={(e) =>
                            updateCriterion(trackId, index, {
                              options: e.target.value
                                .split(",")
                                .map((option) => option.trim())
                                .filter(Boolean),
                            })
                          }
                          placeholder="Option 1, Option 2"
                        />
                      </div>
                    ) : (
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <div className="space-y-1">
                          <Label>Weight</Label>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={criterion.weight ?? 1}
                            onChange={(e) =>
                              updateCriterion(trackId, index, {
                                weight: parseFloat(e.target.value) || 1,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Min Score</Label>
                          <Input
                            type="number"
                            min={0}
                            value={criterion.min ?? 1}
                            onChange={(e) =>
                              updateCriterion(trackId, index, {
                                min: parseInt(e.target.value, 10) || 0,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Max Score</Label>
                          <Input
                            type="number"
                            min={1}
                            value={criterion.max ?? 10}
                            onChange={(e) =>
                              updateCriterion(trackId, index, {
                                max: parseInt(e.target.value, 10) || 10,
                              })
                            }
                          />
                        </div>
                      </div>
                    )}

                    <div className="mt-3 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={track.criteria.length <= 1}
                        onClick={() => removeCriterion(trackId, index)}
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addCriterion(trackId)}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add criterion
              </Button>
            </Card>
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onResetToDefault}>
            Reset To Event Default
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onSave(cloneTracks(tracks));
              onOpenChange(false);
            }}
          >
            Apply Round Rubric
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
