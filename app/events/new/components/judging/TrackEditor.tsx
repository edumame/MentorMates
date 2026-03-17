"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Trophy,
  Tag,
  Scale,
  Pencil,
  X,
  Download,
} from "lucide-react";
import type {
  WizardEventData,
  WizardTrack,
  WizardCriterion,
  WizardPrize,
  WizardStepProps,
} from "@/lib/types/wizard";
import { slugify } from "@/lib/types/wizard";

// ── Default criteria for new tracks ─────────────────────────────────────

const DEFAULT_CRITERIA: Omit<WizardCriterion, "id">[] = [
  {
    name: "Technical Implementation",
    description: "Quality of code, technical complexity, and implementation",
    type: "numeric",
    weight: 1,
    min: 1,
    max: 10,
  },
  {
    name: "Innovation",
    description: "Originality, creativity, and uniqueness of the solution",
    type: "numeric",
    weight: 1,
    min: 1,
    max: 10,
  },
  {
    name: "Impact",
    description: "Potential impact and real-world applicability",
    type: "numeric",
    weight: 1,
    min: 1,
    max: 10,
  },
  {
    name: "Presentation",
    description: "Quality of documentation, demo, and overall presentation",
    type: "numeric",
    weight: 1,
    min: 1,
    max: 10,
  },
];

// ── Main Component ──────────────────────────────────────────────────────

export function TrackEditor({ event, setEvent }: WizardStepProps) {
  const [expandedTrack, setExpandedTrack] = useState<string | null>(
    event.tracks[0]?.client_id ?? null
  );
  const [editingCritId, setEditingCritId] = useState<string | null>(null);

  const tracks = event.tracks;

  const update = (newTracks: WizardTrack[]) =>
    setEvent((prev) => ({ ...prev, tracks: newTracks }));

  const addTrack = () => {
    const idx = tracks.length;
    const clientId = `track-${idx}-${Date.now()}`;
    const newTrack: WizardTrack = {
      client_id: clientId,
      name: "",
      description: "",
      label: "",
      prizes: [],
      criteria: DEFAULT_CRITERIA.map((c, i) => ({
        ...c,
        id: `crit-${idx}-${i}-${Date.now()}`,
      })),
    };
    update([...tracks, newTrack]);
    setExpandedTrack(clientId);
  };

  const removeTrack = (clientId: string) => {
    update(tracks.filter((t) => t.client_id !== clientId));
    if (expandedTrack === clientId) setExpandedTrack(null);
  };

  const updateTrack = (clientId: string, changes: Partial<WizardTrack>) => {
    update(
      tracks.map((t) => {
        if (t.client_id !== clientId) return t;
        const updated = { ...t, ...changes };
        // Auto-update client_id when name changes
        if (changes.name !== undefined) {
          const idx = tracks.findIndex((tr) => tr.client_id === clientId);
          updated.client_id = `track-${idx}-${slugify(changes.name || "track")}`;
        }
        return updated;
      })
    );
  };

  const moveTrack = (index: number, direction: "up" | "down") => {
    const next = [...tracks];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    update(next);
  };

  const addCriterion = (trackClientId: string) => {
    const newId = `crit-${Date.now()}`;
    update(
      tracks.map((t) =>
        t.client_id === trackClientId
          ? {
              ...t,
              criteria: [
                ...t.criteria,
                {
                  id: newId,
                  name: "",
                  description: "",
                  type: "numeric" as const,
                  weight: 1,
                  min: 1,
                  max: 10,
                },
              ],
            }
          : t
      )
    );
    setEditingCritId(newId);
  };

  const updateCriterion = (
    trackClientId: string,
    critId: string,
    changes: Partial<WizardCriterion>
  ) => {
    update(
      tracks.map((t) =>
        t.client_id === trackClientId
          ? {
              ...t,
              criteria: t.criteria.map((c) =>
                c.id === critId ? { ...c, ...changes } : c
              ),
            }
          : t
      )
    );
  };

  const removeCriterion = (trackClientId: string, critId: string) => {
    update(
      tracks.map((t) =>
        t.client_id === trackClientId
          ? { ...t, criteria: t.criteria.filter((c) => c.id !== critId) }
          : t
      )
    );
    if (editingCritId === critId) setEditingCritId(null);
  };

  const addPrize = (trackClientId: string) => {
    update(
      tracks.map((t) =>
        t.client_id === trackClientId
          ? {
              ...t,
              prizes: [
                ...t.prizes,
                {
                  id: `prize-${Date.now()}-${t.prizes.length}`,
                  name: "",
                  description: "",
                },
              ],
            }
          : t
      )
    );
  };

  const updatePrize = (
    trackClientId: string,
    prizeId: string,
    changes: Partial<WizardPrize>
  ) => {
    update(
      tracks.map((t) =>
        t.client_id === trackClientId
          ? {
              ...t,
              prizes: t.prizes.map((p) =>
                p.id === prizeId ? { ...p, ...changes } : p
              ),
            }
          : t
      )
    );
  };

  const removePrize = (trackClientId: string, prizeId: string) => {
    update(
      tracks.map((t) =>
        t.client_id === trackClientId
          ? { ...t, prizes: t.prizes.filter((p) => p.id !== prizeId) }
          : t
      )
    );
  };

  return (
    <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.15)]">
      <div className="px-4 py-4 sm:px-8 sm:py-6">
        {/* Header */}
        <div className="space-y-1 mb-6">
          <h1 className="text-[28px] font-semibold text-black tracking-[-0.06em] leading-[1.4]">
            Tracks & Judging Criteria
          </h1>
          <p className="text-base text-[#7f7f7f]">
            Define competition tracks, scoring criteria, and prizes. Click any
            criterion to edit it, or use + buttons to add new ones.
          </p>
        </div>

        {/* Info callouts */}
        <div className="space-y-3 mb-6">
          <div className="flex items-start gap-3 rounded-xl bg-blue-50 px-4 py-3">
            <Scale className="size-4 text-[#4B89EF] shrink-0 mt-0.5" />
            <p className="text-sm text-blue-700">
              Each criterion has a <strong>weight</strong> for relative
              importance and a <strong>score range</strong> (min-max). Scores are
              weighted to produce a final ranking per track.
            </p>
          </div>
          <div className="flex items-start gap-3 rounded-xl bg-gray-50 px-4 py-3">
            <Download className="size-4 text-gray-500 shrink-0 mt-0.5" />
            <p className="text-sm text-gray-600">
              After judging, you can{" "}
              <strong>export all scores as CSV</strong> from the organizer
              dashboard.
            </p>
          </div>
        </div>

        {/* Tracks */}
        <div className="space-y-4">
          {tracks.map((track, index) => {
            const isExpanded = expandedTrack === track.client_id;
            const totalWeight = track.criteria.reduce(
              (sum, c) => sum + c.weight,
              0
            );

            return (
              <div
                key={track.client_id}
                className={`rounded-xl border transition-colors ${
                  isExpanded
                    ? "border-[#4B89EF]/30 shadow-sm"
                    : "border-[rgba(0,0,0,0.15)]"
                }`}
              >
                {/* Track Header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50/50 transition-colors"
                  onClick={() =>
                    setExpandedTrack(isExpanded ? null : track.client_id)
                  }
                >
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveTrack(index, "up");
                      }}
                      disabled={index === 0}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      <ChevronUp className="size-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveTrack(index, "down");
                      }}
                      disabled={index === tracks.length - 1}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      <ChevronDown className="size-3" />
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-black text-sm truncate block">
                      {track.name || "Untitled Track"}
                    </span>
                    <span className="text-xs text-[#7f7f7f]">
                      {track.criteria.length} criteri
                      {track.criteria.length === 1 ? "on" : "a"}
                      {" · "}
                      {track.prizes.length} prize
                      {track.prizes.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTrack(track.client_id);
                    }}
                    className="p-1.5 text-gray-300 hover:text-red-500 transition-colors shrink-0"
                  >
                    <Trash2 className="size-4" />
                  </button>
                  <ChevronDown
                    className={`size-4 text-gray-400 shrink-0 transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-4 space-y-5">
                    {/* Track Name + Badge */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-500">
                          Track Name
                        </label>
                        <input
                          type="text"
                          value={track.name}
                          onChange={(e) =>
                            updateTrack(track.client_id, {
                              name: e.target.value,
                            })
                          }
                          placeholder="e.g., Best Overall"
                          className="h-10 w-full rounded-xl border border-[rgba(0,0,0,0.15)] bg-white px-3 text-sm outline-none placeholder:text-gray-400 focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF] transition-colors"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-500">
                          Badge Label
                        </label>
                        <input
                          type="text"
                          value={track.label || ""}
                          onChange={(e) =>
                            updateTrack(track.client_id, {
                              label: e.target.value,
                            })
                          }
                          placeholder="e.g., Grand Prize (optional)"
                          className="h-10 w-full rounded-xl border border-[rgba(0,0,0,0.15)] bg-white px-3 text-sm outline-none placeholder:text-gray-400 focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF] transition-colors"
                        />
                      </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500">
                        Description
                      </label>
                      <textarea
                        value={track.description}
                        onChange={(e) =>
                          updateTrack(track.client_id, {
                            description: e.target.value,
                          })
                        }
                        placeholder="What is this track about?"
                        rows={2}
                        className="w-full resize-none rounded-xl border border-[rgba(0,0,0,0.15)] bg-white p-3 text-sm outline-none placeholder:text-gray-400 focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF] transition-colors"
                      />
                    </div>

                    {/* Criteria */}
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
                        {track.criteria.map((crit, cIdx) => {
                          const isEditing = editingCritId === crit.id;
                          return (
                            <div key={crit.id}>
                              {cIdx > 0 && (
                                <CriterionDivider
                                  onClick={() =>
                                    addCriterion(track.client_id)
                                  }
                                />
                              )}
                              {isEditing ? (
                                <CriterionEditor
                                  criterion={crit}
                                  onChange={(changes) =>
                                    updateCriterion(
                                      track.client_id,
                                      crit.id,
                                      changes
                                    )
                                  }
                                  onClose={() => setEditingCritId(null)}
                                  canRemove={track.criteria.length > 1}
                                  onRemove={() =>
                                    removeCriterion(
                                      track.client_id,
                                      crit.id
                                    )
                                  }
                                />
                              ) : (
                                <CriterionRow
                                  criterion={crit}
                                  totalWeight={totalWeight}
                                  onEdit={() => setEditingCritId(crit.id)}
                                  onRemove={() =>
                                    removeCriterion(
                                      track.client_id,
                                      crit.id
                                    )
                                  }
                                  canRemove={track.criteria.length > 1}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => addCriterion(track.client_id)}
                        className="mt-2 flex items-center gap-1 text-xs font-medium text-[#4b89ef] hover:text-[#3d75d9] transition-colors"
                      >
                        <Plus className="size-3.5" />
                        Add criterion
                      </button>
                    </div>

                    {/* Prizes */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-2">
                        Prizes
                      </h4>

                      {track.prizes.length === 0 ? (
                        <p className="text-xs text-gray-400 italic mb-2">
                          No prizes added yet.
                        </p>
                      ) : (
                        <div className="space-y-2 mb-2">
                          {track.prizes.map((prize) => (
                            <div
                              key={prize.id}
                              className="group flex items-center gap-2"
                            >
                              <Trophy className="size-4 text-amber-400 shrink-0" />
                              <input
                                type="text"
                                value={prize.name}
                                onChange={(e) =>
                                  updatePrize(track.client_id, prize.id, {
                                    name: e.target.value,
                                  })
                                }
                                placeholder="e.g., $2000"
                                className="h-8 w-28 rounded-lg border border-gray-200 bg-white px-2 text-sm outline-none focus:border-[#4B89EF] transition-colors"
                              />
                              <input
                                type="text"
                                value={prize.description}
                                onChange={(e) =>
                                  updatePrize(track.client_id, prize.id, {
                                    description: e.target.value,
                                  })
                                }
                                placeholder="Description"
                                className="h-8 flex-1 rounded-lg border border-gray-200 bg-white px-2 text-sm outline-none focus:border-[#4B89EF] transition-colors"
                              />
                              <button
                                onClick={() =>
                                  removePrize(track.client_id, prize.id)
                                }
                                className="p-1 text-gray-300 hover:text-red-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        onClick={() => addPrize(track.client_id)}
                        className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors"
                      >
                        <Plus className="size-3.5" />
                        Add prize
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Empty State */}
          {tracks.length === 0 && (
            <div className="rounded-xl border-2 border-dashed border-gray-200 py-10 text-center">
              <Tag className="mx-auto size-8 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">
                No tracks yet. Add your first track to get started.
              </p>
              <p className="mt-1 text-xs text-gray-400">
                New tracks come with 4 default criteria.
              </p>
            </div>
          )}

          {/* Add Track */}
          <button
            onClick={addTrack}
            className="flex items-center gap-1.5 rounded-xl bg-[rgba(0,0,0,0.04)] px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-[rgba(0,0,0,0.07)]"
          >
            <Plus className="size-4" />
            Add new track
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Criterion Row (compact display) ─────────────────────────────────────

function CriterionRow({
  criterion,
  totalWeight,
  onEdit,
  onRemove,
  canRemove,
}: {
  criterion: WizardCriterion;
  totalWeight: number;
  onEdit: () => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const pct =
    totalWeight > 0
      ? Math.round((criterion.weight / totalWeight) * 100)
      : 0;

  return (
    <div
      className="group flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg hover:bg-gray-50/80 transition-colors cursor-pointer"
      onClick={onEdit}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-black truncate">
          {criterion.name || (
            <span className="text-gray-400 italic">Untitled criterion</span>
          )}
        </p>
        {criterion.description && (
          <p className="text-xs text-[#7f7f7f] truncate mt-0.5">
            {criterion.description}
          </p>
        )}
      </div>

      <span className="shrink-0 inline-flex items-center rounded-full bg-[#4B89EF]/10 px-2 py-0.5 text-[10px] font-semibold text-[#4B89EF]">
        {pct}% · w{criterion.weight}
      </span>

      <span className="shrink-0 text-[10px] text-gray-400 font-mono">
        {criterion.min}-{criterion.max}
      </span>

      <div className="shrink-0 flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="p-1 rounded text-gray-400 hover:text-[#4B89EF]"
        >
          <Pencil className="size-3.5" />
        </button>
        {canRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1 rounded text-gray-400 hover:text-red-500"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Criterion Editor (inline) ───────────────────────────────────────────

function CriterionEditor({
  criterion,
  onChange,
  onClose,
  canRemove,
  onRemove,
}: {
  criterion: WizardCriterion;
  onChange: (changes: Partial<WizardCriterion>) => void;
  onClose: () => void;
  canRemove: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl ring-2 ring-[#4B89EF] bg-blue-50/30 p-4 -mx-2 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[#4B89EF]">
          Editing Criterion
        </span>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 rounded"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_80px]">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Name</label>
          <input
            type="text"
            value={criterion.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="e.g., Technical Complexity"
            autoFocus
            className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Weight</label>
          <input
            type="number"
            min={1}
            max={10}
            value={criterion.weight}
            onChange={(e) =>
              onChange({
                weight: Math.max(1, parseInt(e.target.value, 10) || 1),
              })
            }
            className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm text-center outline-none focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-500">
          Description
        </label>
        <input
          type="text"
          value={criterion.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="What should judges evaluate?"
          className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Score range:</label>
          <input
            type="number"
            min={0}
            value={criterion.min}
            onChange={(e) =>
              onChange({ min: parseInt(e.target.value, 10) || 0 })
            }
            className="w-14 h-7 rounded-md border border-gray-200 bg-white px-1.5 text-xs text-center outline-none focus:border-[#4B89EF]"
          />
          <span className="text-xs text-gray-300">to</span>
          <input
            type="number"
            min={1}
            value={criterion.max}
            onChange={(e) =>
              onChange({ max: parseInt(e.target.value, 10) || 10 })
            }
            className="w-14 h-7 rounded-md border border-gray-200 bg-white px-1.5 text-xs text-center outline-none focus:border-[#4B89EF]"
          />
        </div>

        <div className="flex items-center gap-2">
          {canRemove && (
            <button
              onClick={onRemove}
              className="text-xs text-red-500 hover:text-red-600 font-medium"
            >
              Delete
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg bg-[#4b89ef] hover:bg-[#3d75d9] text-white px-3 py-1.5 text-xs font-medium shadow-sm transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── "+" divider between criteria ────────────────────────────────────────

function CriterionDivider({ onClick }: { onClick: () => void }) {
  return (
    <div className="group relative flex items-center justify-center py-0.5">
      <div className="absolute inset-x-4 top-1/2 h-px bg-transparent group-hover:bg-[#4B89EF]/15 transition-colors" />
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="relative z-10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 inline-flex items-center justify-center rounded-full border border-gray-200 bg-white h-5 w-5 text-gray-300 hover:text-[#4B89EF] hover:border-[#4B89EF]/30 hover:bg-blue-50 shadow-sm transition-all"
      >
        <Plus className="size-2.5" />
      </button>
    </div>
  );
}
