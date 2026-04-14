"use client";

/**
 * Compact scoring form — event-scraper layout ported to MentorMates.
 *
 * Key differences from the old ScoringConfigForm:
 * - Collapsible track cards (header shows name + criteria count)
 * - Compact CriterionRow (click to expand into CriterionEditor)
 * - Weight shown as percentage + raw (e.g., "25% · w1")
 * - Total weight display per track
 * - Much less vertical space per track
 *
 * Keeps the same data model (EventScoringConfig) and the same
 * save/delete patterns as the original form.
 */

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  CopyIcon,
  Pencil,
  PlusIcon,
  Tag,
  TrashIcon,
  Users,
  X,
} from "lucide-react";
import { EventScoringConfig, EventTrack, ScoringCriterion } from "@/lib/types";
import { defaultCriteria } from "@/lib/config/constants";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

// ── Templates ─────────────────────────────────────────────────────────

const TRACK_TEMPLATES: Record<
  string,
  { label: string; criteria: ScoringCriterion[] }
> = {
  blank: { label: "Blank (no criteria)", criteria: [] },
  numeric_10: {
    label: "Numeric 1-10 (standard hackathon)",
    criteria: [
      { id: "technical", name: "Technical Execution", description: "How well is the project built?", type: "numeric", weight: 1, min: 1, max: 10 },
      { id: "creativity", name: "Creativity & Originality", description: "Is the idea novel?", type: "numeric", weight: 1, min: 1, max: 10 },
      { id: "impact", name: "Impact & Relevance", description: "Does it solve a real problem?", type: "numeric", weight: 1, min: 1, max: 10 },
      { id: "presentation", name: "Presentation", description: "Is the pitch clear and compelling?", type: "numeric", weight: 1, min: 1, max: 10 },
    ],
  },
  numeric_5: {
    label: "Numeric 1-5 (simple scale)",
    criteria: [
      { id: "quality", name: "Overall Quality", description: "", type: "numeric", weight: 1, min: 1, max: 5 },
      { id: "creativity", name: "Creativity", description: "", type: "numeric", weight: 1, min: 1, max: 5 },
    ],
  },
  yes_no: {
    label: "Yes/No (binary pass-fail)",
    criteria: [
      { id: "meets_criteria", name: "Meets track criteria", description: "Does this project qualify?", type: "numeric", weight: 1, min: 0, max: 1 },
    ],
  },
};

function sanitizeCriterion(c: ScoringCriterion): ScoringCriterion {
  if (c.type === "multiplechoice") {
    return { ...c, min: undefined, max: undefined, weight: undefined, options: c.options || ["Option 1", "Option 2"] };
  }
  return { ...c, options: undefined };
}

// ── Props ─────────────────────────────────────────────────────────────

interface CompactScoringFormProps {
  initialConfig?: EventScoringConfig | null;
  onSave: (config: EventScoringConfig) => void;
  isSubmitting?: boolean;
  isArchived: boolean;
  eventId: string;
  tracks?: EventTrack[];
}

// ── Main Component ────────────────────────────────────────────────────

export function CompactScoringForm({
  initialConfig,
  onSave,
  isSubmitting = false,
  isArchived,
  eventId,
  tracks: savedTracks = [],
}: CompactScoringFormProps) {
  const [config, setConfig] = useState<EventScoringConfig>(
    initialConfig || { tracks: {}, defaultMin: 0, defaultMax: 10, defaultWeight: 1 }
  );

  // Sync external config changes (from AI sidebar) into the internal state.
  // Uses a ref to avoid re-syncing when the user edits the form locally.
  const lastExternalConfig = useRef(initialConfig);
  useEffect(() => {
    if (
      initialConfig &&
      initialConfig !== lastExternalConfig.current &&
      JSON.stringify(initialConfig) !== JSON.stringify(config)
    ) {
      setConfig(initialConfig);
      // Auto-expand new tracks that weren't there before
      const newTrackIds = Object.keys(initialConfig.tracks).filter(
        (id) => !config.tracks[id]
      );
      if (newTrackIds.length > 0) {
        setExpandedTracks((prev) => {
          const next = new Set(prev);
          newTrackIds.forEach((id) => next.add(id));
          return next;
        });
      }
    }
    lastExternalConfig.current = initialConfig;
  }, [initialConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  const [expandedTracks, setExpandedTracks] = useState<Set<string>>(() => {
    // Auto-expand the first track or all tracks if ≤ 2
    const ids = Object.keys(initialConfig?.tracks || {});
    return new Set(ids.length <= 2 ? ids : ids.slice(0, 1));
  });
  const [editingCritId, setEditingCritId] = useState<string | null>(null);
  const [isAssigningProjects, setIsAssigningProjects] = useState(false);
  const [selectedTrackForBulkAssign, setSelectedTrackForBulkAssign] = useState("");
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [newTrackName, setNewTrackName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("numeric_10");

  const { toast } = useToast();

  const assignableTracks = savedTracks.map((track) => ({
    track_id: track.track_id,
    name: config.tracks[track.track_id]?.name || track.name || "Unnamed Track",
  }));

  // ── Track mutations ─────────────────────────────────────────────────

  const toggleExpanded = (id: string) => {
    setExpandedTracks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const addTrack = () => {
    const id = crypto.randomUUID();
    setConfig((prev) => ({
      ...prev,
      tracks: { ...prev.tracks, [id]: { name: "", criteria: [...defaultCriteria] } },
    }));
    setExpandedTracks((prev) => new Set(prev).add(id));
  };

  const duplicateTrack = (sourceId: string) => {
    const newId = crypto.randomUUID();
    setConfig((prev) => {
      const src = prev.tracks[sourceId];
      if (!src) return prev;
      return {
        ...prev,
        tracks: {
          ...prev.tracks,
          [newId]: { name: src.name ? `${src.name} (Copy)` : "", criteria: src.criteria.map((c) => ({ ...c })) },
        },
      };
    });
    setExpandedTracks((prev) => new Set(prev).add(newId));
    toast({ title: "Track duplicated", description: "Edit the new track name and criteria." });
  };

  const createFromTemplate = () => {
    if (!newTrackName.trim()) return;
    const tmpl = TRACK_TEMPLATES[selectedTemplate];
    if (!tmpl) return;
    const id = crypto.randomUUID();
    setConfig((prev) => ({
      ...prev,
      tracks: { ...prev.tracks, [id]: { name: newTrackName.trim(), criteria: tmpl.criteria.map((c) => ({ ...c })) } },
    }));
    setExpandedTracks((prev) => new Set(prev).add(id));
    setNewTrackName("");
    setSelectedTemplate("numeric_10");
    setTemplateDialogOpen(false);
  };

  const removeTrack = async (id: string) => {
    const { error } = await supabase.from("event_tracks").delete().eq("track_id", id);
    if (error) {
      toast({ title: "Error", description: "Failed to delete track", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Track deleted" });
      setConfig((prev) => {
        const newTracks = { ...prev.tracks };
        delete newTracks[id];
        return { ...prev, tracks: newTracks };
      });
    }
  };

  const updateTrackName = (id: string, name: string) => {
    setConfig((prev) => ({
      ...prev,
      tracks: { ...prev.tracks, [id]: { ...prev.tracks[id], name } },
    }));
  };

  // ── Criterion mutations ─────────────────────────────────────────────

  const addCriterion = (trackId: string) => {
    setConfig((prev) => {
      const base: ScoringCriterion = {
        id: `criterion_${Date.now()}`,
        name: "",
        description: "",
        type: "numeric",
        weight: prev.defaultWeight,
        min: prev.defaultMin,
        max: prev.defaultMax,
      };
      return {
        ...prev,
        tracks: {
          ...prev.tracks,
          [trackId]: {
            ...prev.tracks[trackId],
            criteria: [...prev.tracks[trackId].criteria, sanitizeCriterion(base)],
          },
        },
      };
    });
  };

  const removeCriterion = (trackId: string, index: number) => {
    setConfig((prev) => ({
      ...prev,
      tracks: {
        ...prev.tracks,
        [trackId]: {
          ...prev.tracks[trackId],
          criteria: prev.tracks[trackId].criteria.filter((_, i) => i !== index),
        },
      },
    }));
    setEditingCritId(null);
  };

  const updateCriterion = (trackId: string, index: number, updates: Partial<ScoringCriterion>) => {
    setConfig((prev) => {
      const cur = prev.tracks[trackId].criteria[index];
      let updated = { ...cur, ...updates };
      if (updates.type || updates.options !== undefined) updated = sanitizeCriterion(updated);
      return {
        ...prev,
        tracks: {
          ...prev.tracks,
          [trackId]: {
            ...prev.tracks[trackId],
            criteria: prev.tracks[trackId].criteria.map((c, i) => (i === index ? updated : c)),
          },
        },
      };
    });
  };

  // ── Bulk assign ─────────────────────────────────────────────────────

  const assignAllProjectsToTrack = async (trackId: string) => {
    setIsAssigningProjects(true);
    try {
      const { data: projects } = await supabase
        .from("projects")
        .select("id")
        .eq("event_id", eventId)
        .eq("submitted", true);
      if (!projects?.length) {
        toast({ title: "No projects", description: "No submitted projects to assign." });
        return;
      }
      const rows = projects.map((p) => ({ project_id: p.id, track_id: trackId }));
      const { error } = await supabase.from("project_tracks").upsert(rows, { onConflict: "project_id,track_id", ignoreDuplicates: true });
      if (error) throw error;
      toast({ title: "Assigned", description: `${projects.length} projects assigned to track.` });
    } catch {
      toast({ title: "Error", description: "Failed to assign projects.", variant: "destructive" });
    } finally {
      setIsAssigningProjects(false);
    }
  };

  // ── Submit ──────────────────────────────────────────────────────────

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(config);
  };

  // ── Render ──────────────────────────────────────────────────────────

  const trackEntries = Object.entries(config.tracks);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Bulk assign */}
      {assignableTracks.length > 0 && (
        <Card className="p-5 border border-gray-200 bg-gray-50">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-700" />
              <h3 className="text-sm font-semibold text-gray-900">
                Bulk Assign All Projects to Track
              </h3>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Select value={selectedTrackForBulkAssign} onValueChange={setSelectedTrackForBulkAssign} disabled={isArchived}>
                  <SelectTrigger><SelectValue placeholder="Choose a saved track..." /></SelectTrigger>
                  <SelectContent>
                    {assignableTracks.map((t) => (
                      <SelectItem key={t.track_id} value={t.track_id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                onClick={() => selectedTrackForBulkAssign && assignAllProjectsToTrack(selectedTrackForBulkAssign)}
                disabled={isArchived || isAssigningProjects || !selectedTrackForBulkAssign}
              >
                {isAssigningProjects ? "Assigning..." : "Assign All Projects"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Empty state */}
      {trackEntries.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 px-6 py-10 text-center">
          <Tag className="h-8 w-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">
            No tracks yet. Add your first track to get started.
          </p>
          <p className="text-xs text-gray-500 mt-1">
            New tracks come with 4 default criteria.
          </p>
        </div>
      )}

      {/* Track cards */}
      <div className="space-y-3">
        {trackEntries.map(([trackId, track]) => {
          const isExpanded = expandedTracks.has(trackId);
          const totalWeight = track.criteria.reduce((s, c) => s + (c.weight ?? 1), 0);

          return (
            <Card key={trackId} className="rounded-2xl border border-gray-200 overflow-hidden">
              {/* ── Collapsible header ── */}
              <button
                type="button"
                onClick={() => toggleExpanded(trackId)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-gray-50/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {track.name || <span className="text-gray-400 italic">Untitled Track</span>}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {track.criteria.length} criteria
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                    onClick={(e) => { e.stopPropagation(); duplicateTrack(trackId); }}
                    title="Duplicate"
                  >
                    <CopyIcon className="h-3.5 w-3.5" />
                  </span>
                  <span
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50"
                    onClick={(e) => { e.stopPropagation(); removeTrack(trackId); }}
                    title="Delete"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </span>
                  <ChevronDown className={`h-4 w-4 text-gray-400 ml-1 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </div>
              </button>

              {/* ── Expanded body ── */}
              {isExpanded && (
                <div className="border-t border-gray-100 px-5 py-4 space-y-5">
                  {/* Track name + description */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500">Track Name</label>
                      <Input
                        value={track.name}
                        disabled={isArchived}
                        className="h-10"
                        onChange={(e) => updateTrackName(trackId, e.target.value)}
                        placeholder="e.g., Best Overall"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500">Description</label>
                      <Input disabled={isArchived} className="h-10" placeholder="What is this track about?" />
                    </div>
                  </div>

                  {/* ── Scoring Criteria ── */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
                        Scoring Criteria
                      </h4>
                      <span className="text-[10px] text-gray-400 font-medium">
                        Total weight: {totalWeight}
                      </span>
                    </div>

                    <div className="space-y-0">
                      {track.criteria.map((criterion, idx) => {
                        const pct = totalWeight > 0 ? Math.round(((criterion.weight ?? 1) / totalWeight) * 100) : 0;
                        const isEditing = editingCritId === criterion.id;

                        return (
                          <div key={criterion.id}>
                            {isEditing ? (
                              /* ── Criterion Editor ── */
                              <div className="rounded-xl ring-2 ring-[#4B89EF] bg-blue-50/30 p-4 -mx-1 space-y-3 my-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium text-[#4B89EF]">Editing Criterion</span>
                                  <button type="button" onClick={() => setEditingCritId(null)} className="p-1 text-gray-400 hover:text-gray-600">
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_80px]">
                                  <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-500">Name</label>
                                    <Input
                                      value={criterion.name}
                                      disabled={isArchived}
                                      onChange={(e) => updateCriterion(trackId, idx, { name: e.target.value })}
                                      placeholder="e.g., Technical Complexity"
                                      autoFocus
                                      className="h-9"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-500">Weight</label>
                                    <Input
                                      type="number" min={0} step={0.01}
                                      value={criterion.weight}
                                      disabled={isArchived}
                                      onChange={(e) => updateCriterion(trackId, idx, { weight: parseFloat(e.target.value) || 1 })}
                                      className="h-9 text-center"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-gray-500">Description</label>
                                  <Input
                                    value={criterion.description}
                                    disabled={isArchived}
                                    onChange={(e) => updateCriterion(trackId, idx, { description: e.target.value })}
                                    placeholder="What should judges evaluate?"
                                    className="h-9"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <label className="text-xs font-medium text-gray-500 w-24 shrink-0">Question type</label>
                                    <Select
                                      value={criterion.type || "numeric"}
                                      disabled={isArchived}
                                      onValueChange={(value) => updateCriterion(trackId, idx, { type: value as "numeric" | "multiplechoice" })}
                                    >
                                      <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="numeric">Numeric Scale</SelectItem>
                                        <SelectItem value="multiplechoice">Multiple Choice</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  {criterion.type === "multiplechoice" ? (
                                    <div className="space-y-1.5">
                                      <label className="text-xs font-medium text-gray-500">Options</label>
                                      <div className="space-y-1.5">
                                        {(criterion.options ?? []).map((option, optionIndex) => (
                                          <div key={optionIndex} className="flex items-center gap-2">
                                            <Input
                                              value={option}
                                              disabled={isArchived}
                                              onChange={(e) => {
                                                const newOptions = [...(criterion.options ?? [])];
                                                newOptions[optionIndex] = e.target.value;
                                                updateCriterion(trackId, idx, { options: newOptions });
                                              }}
                                              placeholder={`Option ${optionIndex + 1}`}
                                              className="h-8 text-xs"
                                            />
                                            <button
                                              type="button"
                                              disabled={isArchived || (criterion.options ?? []).length <= 1}
                                              onClick={() => {
                                                const newOptions = (criterion.options ?? []).filter((_, i) => i !== optionIndex);
                                                updateCriterion(trackId, idx, { options: newOptions });
                                              }}
                                              className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:hover:text-gray-400"
                                              title="Remove option"
                                            >
                                              <TrashIcon className="h-3.5 w-3.5" />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                      <button
                                        type="button"
                                        disabled={isArchived}
                                        onClick={() => {
                                          const newOptions = [...(criterion.options ?? []), ""];
                                          updateCriterion(trackId, idx, { options: newOptions });
                                        }}
                                        className="flex items-center gap-1 text-xs font-medium text-[#4b89ef] hover:text-[#3d75d9] disabled:opacity-50"
                                      >
                                        <PlusIcon className="h-3.5 w-3.5" />
                                        Add option
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-500 w-24 shrink-0">Score range</span>
                                      <Input
                                        type="number" min={0}
                                        value={criterion.min ?? 0}
                                        disabled={isArchived}
                                        onChange={(e) => updateCriterion(trackId, idx, { min: parseInt(e.target.value) || 0 })}
                                        className="w-14 h-7 text-xs text-center"
                                      />
                                      <span className="text-xs text-gray-300">to</span>
                                      <Input
                                        type="number" min={1}
                                        value={criterion.max ?? 10}
                                        disabled={isArchived}
                                        onChange={(e) => updateCriterion(trackId, idx, { max: parseInt(e.target.value) || 10 })}
                                        className="w-14 h-7 text-xs text-center"
                                      />
                                    </div>
                                  )}
                                  <div className="flex items-center justify-end gap-2 pt-1">
                                    {track.criteria.length > 1 && (
                                      <button type="button" onClick={() => removeCriterion(trackId, idx)} className="text-xs text-red-500 hover:text-red-600 font-medium">
                                        Delete
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => setEditingCritId(null)}
                                      className="rounded-lg bg-[#4b89ef] hover:bg-[#3d75d9] text-white px-3 py-1.5 text-xs font-medium shadow-sm"
                                    >
                                      Done
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              /* ── Criterion Row (compact) ── */
                              <div
                                className="group flex items-center gap-3 py-2.5 px-2 -mx-1 rounded-lg hover:bg-gray-50/80 transition-colors cursor-pointer"
                                onClick={() => !isArchived && setEditingCritId(criterion.id)}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-black truncate">
                                    {criterion.name || <span className="text-gray-400 italic">Untitled criterion</span>}
                                  </p>
                                  {criterion.description && (
                                    <p className="text-xs text-gray-500 truncate mt-0.5">{criterion.description}</p>
                                  )}
                                </div>
                                <span className="shrink-0 inline-flex items-center rounded-full bg-[#4B89EF]/10 px-2 py-0.5 text-[10px] font-semibold text-[#4B89EF]">
                                  {pct}% · w{criterion.weight ?? 1}
                                </span>
                                <span className="shrink-0 text-[10px] text-gray-400 font-mono">
                                  {criterion.type === "multiplechoice"
                                    ? `${(criterion.options ?? []).length} opts`
                                    : `${criterion.min ?? 0}-${criterion.max ?? 10}`}
                                </span>
                                <div className="shrink-0 flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                  <span className="p-1 rounded text-gray-400 hover:text-[#4B89EF]">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </span>
                                  {track.criteria.length > 1 && (
                                    <span
                                      className="p-1 rounded text-gray-400 hover:text-red-500"
                                      onClick={(e) => { e.stopPropagation(); removeCriterion(trackId, idx); }}
                                    >
                                      <TrashIcon className="h-3.5 w-3.5" />
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => addCriterion(trackId)}
                      disabled={isArchived}
                      className="mt-2 flex items-center gap-1 text-xs font-medium text-[#4b89ef] hover:text-[#3d75d9] transition-colors disabled:opacity-50"
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                      Add criterion
                    </button>
                  </div>

                  {/* ── Prizes (inline placeholder) ── */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-2">
                      Prizes
                    </h4>
                    <p className="text-xs text-gray-400 italic">
                      No prizes added yet.
                    </p>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Bottom actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={addTrack} disabled={isArchived} className="gap-1.5 px-3">
          <PlusIcon className="h-4 w-4" />
          Add new track
        </Button>
        <Button type="button" variant="outline" onClick={() => setTemplateDialogOpen(true)} disabled={isArchived} className="gap-1.5 px-3">
          <PlusIcon className="h-4 w-4" />
          New from template
        </Button>
        <Button type="submit" disabled={isSubmitting || isArchived} className="px-4">
          {isSubmitting ? "Saving..." : "Save Scoring Configuration"}
        </Button>
      </div>

      {/* Template dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New track from template</DialogTitle>
            <DialogDescription>Name your track and pick a template.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Track name</Label>
              <Input value={newTrackName} onChange={(e) => setNewTrackName(e.target.value)} placeholder="e.g. Best AI Project" autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TRACK_TEMPLATES).map(([key, tmpl]) => (
                    <SelectItem key={key} value={key}>{tmpl.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {TRACK_TEMPLATES[selectedTemplate]?.criteria.length ?? 0} criteria pre-filled.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>Cancel</Button>
            <Button onClick={createFromTemplate} disabled={!newTrackName.trim()}>Create track</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
