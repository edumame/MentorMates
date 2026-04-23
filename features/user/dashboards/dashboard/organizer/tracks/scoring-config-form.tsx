"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { TrashIcon, PlusIcon, Users, CopyIcon } from "lucide-react";
import { EventScoringConfig, EventTrack, ScoringCriterion } from "@/lib/types";
import { defaultCriteria } from "@/lib/config/constants";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

// Scoring criteria templates for the "New track from template" flow
const TRACK_TEMPLATES: Record<
  string,
  { label: string; criteria: ScoringCriterion[] }
> = {
  blank: {
    label: "Blank (no criteria)",
    criteria: [],
  },
  numeric_10: {
    label: "Numeric 1-10 (standard hackathon)",
    criteria: [
      { id: "technical", name: "Technical Execution", description: "How well is the project built?", type: "numeric", weight: 0.25, min: 1, max: 10 },
      { id: "creativity", name: "Creativity & Originality", description: "Is the idea novel?", type: "numeric", weight: 0.25, min: 1, max: 10 },
      { id: "impact", name: "Impact & Relevance", description: "Does it solve a real problem?", type: "numeric", weight: 0.25, min: 1, max: 10 },
      { id: "presentation", name: "Presentation", description: "Is the pitch clear and compelling?", type: "numeric", weight: 0.25, min: 1, max: 10 },
    ],
  },
  numeric_5: {
    label: "Numeric 1-5 (simple scale)",
    criteria: [
      { id: "quality", name: "Overall Quality", description: "", type: "numeric", weight: 0.5, min: 1, max: 5 },
      { id: "creativity", name: "Creativity", description: "", type: "numeric", weight: 0.5, min: 1, max: 5 },
    ],
  },
  yes_no: {
    label: "Yes/No (binary pass-fail)",
    criteria: [
      { id: "meets_criteria", name: "Meets track criteria", description: "Does this project qualify for the track?", type: "numeric", weight: 1, min: 0, max: 1 },
    ],
  },
};
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ScoringConfigFormProps {
  initialConfig?: EventScoringConfig | null;
  onSave: (config: EventScoringConfig) => void;
  isSubmitting?: boolean;
  isArchived: boolean;
  eventId: string;
  tracks?: EventTrack[];
}

export function ScoringConfigForm({
  initialConfig,
  onSave,
  isSubmitting = false,
  isArchived,
  eventId,
  tracks = [],
}: ScoringConfigFormProps) {
  const [config, setConfig] = useState<EventScoringConfig>(
    initialConfig || {
      tracks: {},
      defaultMin: 0,
      defaultMax: 10,
      defaultWeight: 1,
    }
  );
  const [isAssigningProjects, setIsAssigningProjects] = useState(false);
  const [selectedTrackForBulkAssign, setSelectedTrackForBulkAssign] =
    useState<string>("");

  const { toast } = useToast();

  const assignableTracks = tracks.map((track) => ({
    track_id: track.track_id,
    name: config.tracks[track.track_id]?.name || track.name || "Unnamed Track",
  }));

  const addTrack = () => {
    const trackId = crypto.randomUUID();
    setConfig((prev) => ({
      ...prev,
      tracks: {
        ...prev.tracks,
        [trackId]: {
          name: "",
          criteria: [...defaultCriteria],
        },
      },
    }));
  };

  // Duplicate an existing track including its criteria
  const duplicateTrack = (sourceTrackId: string) => {
    const newTrackId = crypto.randomUUID();
    setConfig((prev) => {
      const sourceTrack = prev.tracks[sourceTrackId];
      if (!sourceTrack) return prev;
      return {
        ...prev,
        tracks: {
          ...prev.tracks,
          [newTrackId]: {
            name: sourceTrack.name ? `${sourceTrack.name} (Copy)` : "",
            criteria: sourceTrack.criteria.map((c) => ({ ...c })),
          },
        },
      };
    });
    toast({
      title: "Track duplicated",
      description: "Edit the new track name and criteria as needed.",
    });
  };

  // Template dialog state
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [newTrackName, setNewTrackName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("numeric_10");

  const createTrackFromTemplate = () => {
    if (!newTrackName.trim()) return;
    const template = TRACK_TEMPLATES[selectedTemplate];
    if (!template) return;
    const trackId = crypto.randomUUID();
    setConfig((prev) => ({
      ...prev,
      tracks: {
        ...prev.tracks,
        [trackId]: {
          name: newTrackName.trim(),
          criteria: template.criteria.map((c) => ({ ...c })),
        },
      },
    }));
    setNewTrackName("");
    setSelectedTemplate("numeric_10");
    setTemplateDialogOpen(false);
  };

  const removeTrack = async (trackId: string) => {
    const { error } = await supabase
      .from("event_tracks")
      .delete()
      .eq("track_id", trackId);
    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete track",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Track deleted successfully",
      });
      setConfig((prev) => {
        const newTracks = { ...prev.tracks };
        delete newTracks[trackId];
        return { ...prev, tracks: newTracks };
      });
    }
  };

  const updateTrackName = (trackId: string, name: string) => {
    setConfig((prev) => ({
      ...prev,
      tracks: {
        ...prev.tracks,
        [trackId]: {
          ...prev.tracks[trackId],
          name: name,
        },
      },
    }));
  };

  const addCriterion = (trackId: string) => {
    setConfig((prev) => {
      // Create base criterion
      const baseId = `criterion_${prev.tracks[trackId].criteria.length + 1}`;
      const baseCriterion: ScoringCriterion = {
        id: baseId,
        name: "",
        description: "",
        type: "numeric",
        weight: prev.defaultWeight,
        min: prev.defaultMin,
        max: prev.defaultMax,
      };

      // Sanitize based on criterion type
      const sanitizedCriterion = sanitizeCriterion(baseCriterion);

      return {
        ...prev,
        tracks: {
          ...prev.tracks,
          [trackId]: {
            ...prev.tracks[trackId],
            criteria: [...prev.tracks[trackId].criteria, sanitizedCriterion],
          },
        },
      };
    });
  };

  const removeCriterion = (trackId: string, criterionIndex: number) => {
    setConfig((prev) => ({
      ...prev,
      tracks: {
        ...prev.tracks,
        [trackId]: {
          ...prev.tracks[trackId],
          criteria: prev.tracks[trackId].criteria.filter(
            (_, i) => i !== criterionIndex
          ),
        },
      },
    }));
  };

  const updateCriterion = (
    trackId: string,
    criterionIndex: number,
    updates: Partial<ScoringCriterion>
  ) => {
    setConfig((prev) => {
      const currentCriterion = prev.tracks[trackId].criteria[criterionIndex];
      const updatedCriterion = { ...currentCriterion, ...updates };

      // Only sanitize when type changes or when specific properties need sanitization
      let finalCriterion = updatedCriterion;
      if (updates.type || updates.options !== undefined) {
        finalCriterion = sanitizeCriterion(updatedCriterion);
      }

      return {
        ...prev,
        tracks: {
          ...prev.tracks,
          [trackId]: {
            ...prev.tracks[trackId],
            criteria: prev.tracks[trackId].criteria.map((c, i) =>
              i === criterionIndex ? finalCriterion : c
            ),
          },
        },
      };
    });
  };

  // Function to sanitize criterion properties based on type
  const sanitizeCriterion = (criterion: ScoringCriterion): ScoringCriterion => {
    const { type } = criterion;
    const sanitized = { ...criterion };

    if (type === "multiplechoice") {
      // For choice-based criteria, remove numeric scoring properties
      delete sanitized.min;
      delete sanitized.max;

      // Ensure options array exists
      if (!sanitized.options || !Array.isArray(sanitized.options)) {
        sanitized.options = [""];
      }
    } else if (type === "numeric") {
      // For numeric criteria, remove choice properties
      delete sanitized.options;

      // Ensure numeric properties exist
      sanitized.min = sanitized.min ?? config.defaultMin;
      sanitized.max = sanitized.max ?? config.defaultMax;
      sanitized.weight = sanitized.weight ?? config.defaultWeight;
    }

    return sanitized;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(config);
  };

  const assignAllProjectsToTrack = async (trackId: string) => {
    try {
      setIsAssigningProjects(true);

      const { data: projects, error: projectsError } = await supabase
        .from("projects")
        .select("id")
        .eq("event_id", eventId);

      if (projectsError) {
        throw projectsError;
      }

      if (!projects || projects.length === 0) {
        toast({
          title: "No Projects",
          description: "There are no projects to assign to this track.",
          variant: "destructive",
        });
        return;
      }

      const projectTrackEntries = projects.map((project) => ({
        project_id: project.id,
        track_id: trackId,
      }));

      const { error: upsertError } = await supabase
        .from("project_tracks")
        .upsert(projectTrackEntries, {
          onConflict: "project_id,track_id",
          ignoreDuplicates: false,
        });

      if (upsertError) {
        throw upsertError;
      }

      toast({
        title: "Success",
        description: `Successfully assigned ${projects.length} project(s) to this track.`,
      });
    } catch (error) {
      console.error("Error assigning projects to track:", error);
      toast({
        title: "Error",
        description: "Failed to assign projects to track",
        variant: "destructive",
      });
    } finally {
      setIsAssigningProjects(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {assignableTracks.length > 0 && (
        <Card className="p-5 border border-gray-200 bg-gray-50">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-700" />
              <h3 className="text-base font-semibold text-gray-900">
                Bulk Assign All Projects to Track
              </h3>
            </div>
            <p className="text-sm text-gray-600">
              Assign all projects in this event to a selected saved track. This
              will not remove existing track assignments.
            </p>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-900 block mb-2">
                  Select Track
                </label>
                <Select
                  value={selectedTrackForBulkAssign}
                  onValueChange={setSelectedTrackForBulkAssign}
                  disabled={isArchived}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a saved track..." />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableTracks.map((track) => (
                      <SelectItem key={track.track_id} value={track.track_id}>
                        {track.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="default"
                onClick={() => {
                  if (selectedTrackForBulkAssign) {
                    assignAllProjectsToTrack(selectedTrackForBulkAssign);
                    return;
                  }

                  toast({
                    title: "No Track Selected",
                    description: "Please select a track first.",
                    variant: "destructive",
                  });
                }}
                disabled={
                  isArchived ||
                  isAssigningProjects ||
                  !selectedTrackForBulkAssign
                }
                className="min-w-[200px]"
              >
                <Users className="h-4 w-4 mr-2" />
                {isAssigningProjects ? "Assigning..." : "Assign All Projects"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              className="font-sans font-normal leading-[150%] text-[var(--Color-Scheme-1-Text,#000)]"
              style={{ fontSize: "var(--Text-Sizes-Text-Regular, 16px)" }}
            >
              Default Min Score
            </label>
            <Input
              type="number"
              value={config.defaultMin}
              disabled={isArchived}
              className="mt-1 h-10"
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  defaultMin: parseInt(e.target.value),
                }))
              }
              min={0}
            />
          </div>
          <div>
            <label
              className="font-sans font-normal leading-[150%] text-[var(--Color-Scheme-1-Text,#000)]"
              style={{ fontSize: "var(--Text-Sizes-Text-Regular, 16px)" }}
            >
              Default Max Score
            </label>
            <Input
              type="number"
              value={config.defaultMax}
              disabled={isArchived}
              className="mt-1 h-10"
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  defaultMax: parseInt(e.target.value),
                }))
              }
              min={1}
            />
          </div>
          <div>
            <label
              className="font-sans font-normal leading-[150%] text-[var(--Color-Scheme-1-Text,#000)]"
              style={{ fontSize: "var(--Text-Sizes-Text-Regular, 16px)" }}
            >
              Default Weight
            </label>
            <Input
              type="number"
              value={config.defaultWeight}
              disabled={isArchived}
              className="mt-1 h-10"
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  defaultWeight: parseFloat(e.target.value),
                }))
              }
              min={0}
              step={0.1}
            />
          </div>
        </div>

        {Object.entries(config.tracks).map(([trackId, track]) => (
          <Card key={trackId} className="rounded-2xl border border-gray-200">
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900">Track Name</h3>
                  <Input
                    value={track.name}
                    disabled={isArchived}
                    className="mt-1 h-10"
                    onChange={(e) => {
                      updateTrackName(trackId, e.target.value);
                    }}
                    placeholder="Enter track name"
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => duplicateTrack(trackId)}
                  disabled={isArchived}
                  className="text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  title="Duplicate this track"
                >
                  <CopyIcon className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeTrack(trackId)}
                  disabled={isArchived}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  title="Delete this track"
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                {track.criteria.map((criterion, index) => (
                  <div
                    key={criterion.id}
                    className="flex flex-col items-start gap-4 self-stretch rounded-xl border border-gray-200 p-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-1 space-y-4">
                        <div>
                          <label className="text-sm font-medium">
                            Criterion Name
                          </label>
                          <Input
                            value={criterion.name}
                            disabled={isArchived}
                            className="mt-1 h-10"
                            onChange={(e) =>
                              updateCriterion(trackId, index, {
                                name: e.target.value,
                              })
                            }
                            placeholder="Enter criterion name"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">
                            Description
                          </label>
                          <Textarea
                            value={criterion.description}
                            disabled={isArchived}
                            className="mt-1"
                            onChange={(e) =>
                              updateCriterion(trackId, index, {
                                description: e.target.value,
                              })
                            }
                            placeholder="Enter criterion description"
                          />
                        </div>

                        {/* Add question type selector */}
                        <div>
                          <label className="text-sm font-medium">
                            Question Type
                          </label>
                          <Select
                            value={criterion.type || "numeric"}
                            disabled={isArchived}
                            onValueChange={(value) =>
                              updateCriterion(trackId, index, {
                                type: value as "numeric" | "multiplechoice",
                              })
                            }
                          >
                            <SelectTrigger className="w-full mt-1 h-10">
                              <SelectValue placeholder="Select question type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="numeric">
                                Numeric Scale
                              </SelectItem>
                              <SelectItem value="multiplechoice">
                                Multiple Choice
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Show different fields based on question type */}
                        {criterion.type === "multiplechoice" ? (
                          <div className="space-y-2">
                            <label className="text-sm font-medium">
                              Options
                            </label>
                            <div className="space-y-2">
                              {criterion.options?.map((option, optionIndex) => (
                                <div key={optionIndex} className="flex gap-2">
                                  <Input
                                    value={option}
                                    disabled={isArchived}
                                    onChange={(e) => {
                                      const newOptions = [
                                        ...(criterion.options || []),
                                      ];
                                      newOptions[optionIndex] = e.target.value;
                                      updateCriterion(trackId, index, {
                                        options: newOptions,
                                      });
                                    }}
                                    placeholder="Enter option"
                                  />
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon"
                                    disabled={isArchived}
                                    onClick={() => {
                                      const newOptions =
                                        criterion.options?.filter(
                                          (_, i) => i !== optionIndex
                                        );
                                      updateCriterion(trackId, index, {
                                        options: newOptions,
                                      });
                                    }}
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isArchived}
                                onClick={() => {
                                  const newOptions = [
                                    ...(criterion.options || []),
                                    "",
                                  ];
                                  updateCriterion(trackId, index, {
                                    options: newOptions,
                                  });
                                }}
                              >
                                <PlusIcon className="h-4 w-4 mr-2" />
                                Add Option
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="text-sm font-medium">
                                Min Score
                              </label>
                              <Input
                                type="number"
                                value={criterion.min ?? config.defaultMin}
                                disabled={isArchived}
                                className="mt-1 h-10"
                                onChange={(e) =>
                                  updateCriterion(trackId, index, {
                                    min: parseInt(e.target.value),
                                  })
                                }
                                min={0}
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium">
                                Max Score
                              </label>
                              <Input
                                type="number"
                                value={criterion.max ?? config.defaultMax}
                                disabled={isArchived}
                                className="mt-1 h-10"
                                onChange={(e) =>
                                  updateCriterion(trackId, index, {
                                    max: parseInt(e.target.value),
                                  })
                                }
                                min={1}
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium">
                                Weight
                              </label>
                              <Input
                                type="number"
                                value={criterion.weight ?? config.defaultWeight}
                                disabled={isArchived}
                                className="mt-1 h-10"
                                onChange={(e) =>
                                  updateCriterion(trackId, index, {
                                    weight: parseFloat(e.target.value),
                                  })
                                }
                                min={0}
                                step={0.01}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCriterion(trackId, index)}
                        disabled={isArchived}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => addCriterion(trackId)}
                className="w-full rounded-xl"
                disabled={isArchived}
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Criterion
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="button"
          variant="defaultGray"
          onClick={addTrack}
          className="gap-1.5 shrink-0 px-3"
          disabled={isArchived}
        >
          <PlusIcon className="h-4 w-4" />
          Add blank track
        </Button>

        <Button
          type="button"
          variant="defaultGray"
          onClick={() => setTemplateDialogOpen(true)}
          className="gap-1.5 shrink-0 px-3"
          disabled={isArchived}
        >
          <PlusIcon className="h-4 w-4" />
          New track from template
        </Button>

        <Button
          type="submit"
          disabled={isSubmitting || isArchived}
          className="px-3 shrink-0"
        >
          {isSubmitting ? "Saving..." : "Save Scoring Configuration"}
        </Button>
      </div>

      {/* Template dialog — asks for track name first, then applies template */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New track from template</DialogTitle>
            <DialogDescription>
              Name your track and pick a template. You can always edit the
              criteria after.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-track-name">Track name</Label>
              <Input
                id="new-track-name"
                value={newTrackName}
                onChange={(e) => setNewTrackName(e.target.value)}
                placeholder="e.g. Best AI Project"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-track-template">Template</Label>
              <Select
                value={selectedTemplate}
                onValueChange={setSelectedTemplate}
              >
                <SelectTrigger id="new-track-template">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TRACK_TEMPLATES).map(([key, tmpl]) => (
                    <SelectItem key={key} value={key}>
                      {tmpl.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {TRACK_TEMPLATES[selectedTemplate]?.criteria.length ?? 0}{" "}
                criteria will be pre-filled.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTemplateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={createTrackFromTemplate}
              disabled={!newTrackName.trim()}
            >
              Create track
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
