"use client";

import { useState, useMemo, useCallback } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Search,
  Scale,
} from "lucide-react";
import type { EventScoringConfig, ScoringCriterion } from "@/lib/types";
import { ScoringFormUI } from "@/components/project-scoring/scoring-form-ui";

// ── Types ───────────────────────────────────────────────────────────────

interface TrackConfig {
  id: string;
  name: string;
  criteria: Array<{
    id: string;
    name: string;
    description?: string;
    weight?: number;
    min: number;
    max: number;
  }>;
}

interface DummyProject {
  id: string;
  project_name: string;
  project_description: string;
  track_ids: string[];
  scored_track_ids: string[];
}

// ── Dummy data ──────────────────────────────────────────────────────────

function generateDummyScores(
  criteria: ScoringCriterion[],
  projectId: string
): Record<string, number> {
  const scores: Record<string, number> = {};
  criteria.forEach((c) => {
    const min = c.min ?? 1;
    const max = c.max ?? 10;
    const range = max - min;
    const hash = (projectId.charCodeAt(5) || 3) * (c.id.charCodeAt(2) || 7);
    scores[c.id] = min + Math.round((range * ((hash % 60) + 40)) / 100);
  });
  return scores;
}

function buildDummyProjects(tracks: TrackConfig[]): DummyProject[] {
  const trackIds = tracks.map((t) => t.id);
  if (trackIds.length === 0) return [];

  return [
    {
      id: "demo-1",
      project_name: "Relief Map",
      project_description:
        "An AI-powered disaster response tool that maps affected areas in real-time using satellite imagery and social media signals.",
      track_ids: trackIds,
      scored_track_ids: [trackIds[0]],
    },
    {
      id: "demo-2",
      project_name: "EcoTrack",
      project_description:
        "A carbon footprint tracker that gamifies sustainability habits with team challenges and leaderboards.",
      track_ids: trackIds.length > 1 ? [trackIds[1]] : [trackIds[0]],
      scored_track_ids: [],
    },
    {
      id: "demo-3",
      project_name: "MedAssist AI",
      project_description:
        "Voice-first medical assistant for rural clinics that helps triage patients and suggests preliminary diagnoses.",
      track_ids: trackIds,
      scored_track_ids: trackIds,
    },
  ];
}

function isFullyScored(project: DummyProject): boolean {
  return (
    project.track_ids.length > 0 &&
    project.track_ids.every((tid) => project.scored_track_ids.includes(tid))
  );
}

// ── Main Component ──────────────────────────────────────────────────────

interface JudgePreviewDeckProps {
  scoringConfig: EventScoringConfig | null;
  onClose: () => void;
}

export function JudgePreviewDeck({
  scoringConfig,
  onClose,
}: JudgePreviewDeckProps) {
  // Convert MentorMates scoring config → flat track list
  const tracks: TrackConfig[] = useMemo(() => {
    if (!scoringConfig?.tracks) return [];
    return Object.entries(scoringConfig.tracks).map(([id, track]) => ({
      id,
      name: track.name,
      criteria: track.criteria.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        weight: c.weight,
        min: c.min ?? 1,
        max: c.max ?? 10,
      })),
    }));
  }, [scoringConfig]);

  const allProjects = useMemo(() => buildDummyProjects(tracks), [tracks]);
  const [activeProjectId, setActiveProjectId] = useState(
    allProjects[0]?.id ?? ""
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [deckFilter, setDeckFilter] = useState<"pending" | "all">("all");
  const [isNavigatorOpen, setIsNavigatorOpen] = useState(true);
  const [openTrackIds, setOpenTrackIds] = useState<Record<string, string[]>>(
    {}
  );

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredProjects = useMemo(
    () =>
      allProjects.filter(
        (p) =>
          p.project_name.toLowerCase().includes(normalizedSearch) ||
          p.project_description.toLowerCase().includes(normalizedSearch)
      ),
    [allProjects, normalizedSearch]
  );
  const remainingProjects = useMemo(
    () => filteredProjects.filter((p) => !isFullyScored(p)),
    [filteredProjects]
  );
  const visibleProjects = useMemo(
    () => (deckFilter === "all" ? filteredProjects : remainingProjects),
    [deckFilter, filteredProjects, remainingProjects]
  );
  const judgedCount = useMemo(
    () => allProjects.filter((p) => isFullyScored(p)).length,
    [allProjects]
  );
  const currentProject = useMemo(
    () =>
      visibleProjects.find((p) => p.id === activeProjectId) ??
      visibleProjects[0] ??
      null,
    [visibleProjects, activeProjectId]
  );
  const currentIndex = useMemo(
    () =>
      currentProject
        ? visibleProjects.findIndex((p) => p.id === currentProject.id)
        : -1,
    [visibleProjects, currentProject]
  );

  const navigateCards = useCallback(
    (direction: 1 | -1) => {
      if (visibleProjects.length <= 1) return;
      const nextIndex =
        (currentIndex + direction + visibleProjects.length) %
        visibleProjects.length;
      setActiveProjectId(visibleProjects[nextIndex].id);
    },
    [visibleProjects, currentIndex]
  );

  const currentOpenTrackIds = useMemo(() => {
    if (!currentProject || currentProject.track_ids.length === 0) return [];
    const selected = openTrackIds[currentProject.id];
    if (selected) return selected;
    return [currentProject.track_ids[0]];
  }, [currentProject, openTrackIds]);

  const currentTrackScoredCount = useMemo(() => {
    if (!currentProject) return 0;
    return currentProject.scored_track_ids.length;
  }, [currentProject]);

  const upcomingCards =
    currentIndex >= 0
      ? visibleProjects.slice(currentIndex + 1, currentIndex + 3)
      : [];

  if (tracks.length === 0) {
    return (
      <div className="mx-auto flex max-w-[900px] flex-col items-center gap-6 rounded-3xl border border-dashed border-[#D7DCE4] bg-[#F8FAFD] px-4 py-10 text-center sm:px-8 sm:py-16">
        <Scale className="h-10 w-10 text-[#4B89EF]" />
        <h2 className="text-[28px] font-semibold leading-[1.3] tracking-[-0.04em] text-black">
          No tracks configured
        </h2>
        <p className="max-w-[540px] text-[15px] text-[rgba(0,0,0,0.68)]">
          Switch to Edit mode to add tracks and judging criteria, then come
          back to preview the judging experience.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-[#4b89ef] px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#3d75d9] transition-colors"
        >
          Switch to Edit
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Preview banner */}
      <div className="mb-5 flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
        <Scale className="h-5 w-5 text-amber-600 shrink-0" />
        <p className="text-sm text-amber-900">
          <strong>Preview mode</strong> — this shows what judges see when scoring
          projects. Data is simulated with 3 sample projects.
        </p>
      </div>

      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5">
        {/* Search + Filter + Nav */}
        <section className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className="h-10 w-full rounded-xl border border-[rgba(0,0,0,0.15)] bg-gray-50 pl-9 pr-3 text-sm outline-none placeholder:text-[rgba(0,0,0,0.35)] focus:border-[#4b89ef] focus:bg-white focus:ring-1 focus:ring-[#4b89ef]"
            />
            {searchQuery && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
                onClick={() => setSearchQuery("")}
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex h-10 items-center rounded-xl border border-[#D6DEEC] bg-[#F5F8FD] p-1">
              <button
                type="button"
                className={`inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium transition ${
                  deckFilter === "pending"
                    ? "bg-white text-[#19489A] shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setDeckFilter("pending")}
              >
                Pending ({remainingProjects.length})
              </button>
              <button
                type="button"
                className={`inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium transition ${
                  deckFilter === "all"
                    ? "bg-white text-[#19489A] shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setDeckFilter("all")}
              >
                All ({filteredProjects.length})
              </button>
            </div>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40"
              onClick={() => navigateCards(-1)}
              disabled={visibleProjects.length <= 1}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40"
              onClick={() => navigateCards(1)}
              disabled={visibleProjects.length <= 1}
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        {/* Project Navigator */}
        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[rgba(0,0,0,0.82)]">
              Project Navigator
            </p>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 items-center rounded-full bg-[#E8F8EC] px-2.5 text-xs font-semibold text-[#19703A]">
                Judged {judgedCount}/{allProjects.length}
              </span>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1 rounded-md border border-[#D4DDEC] bg-white px-2.5 text-xs font-medium text-gray-500 hover:bg-gray-50"
                onClick={() => setIsNavigatorOpen((prev) => !prev)}
              >
                {isNavigatorOpen ? "Hide" : "Show"}
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${
                    isNavigatorOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>
          </div>
          {isNavigatorOpen && (
            <div className="max-h-48 overflow-auto rounded-xl bg-[#FBFCFE]">
              {visibleProjects.map((project, index) => {
                const isJudged = isFullyScored(project);
                const isActive = currentProject?.id === project.id;
                return (
                  <button
                    key={project.id}
                    type="button"
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition ${
                      index !== visibleProjects.length - 1
                        ? "border-b border-[#E7EDF8]"
                        : ""
                    } ${isActive ? "bg-[#EAF2FF]" : "hover:bg-[#F2F6FD]"}`}
                    onClick={() => setActiveProjectId(project.id)}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[rgba(0,0,0,0.84)]">
                        {project.project_name}
                      </p>
                      <p className="text-xs text-[rgba(0,0,0,0.52)]">
                        Tracks scored{" "}
                        {project.scored_track_ids.length}/
                        {project.track_ids.length}
                      </p>
                    </div>
                    <span
                      className={`inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold ${
                        isJudged
                          ? "bg-[#E8F8EC] text-[#19703A]"
                          : "bg-[#FFF5E5] text-[#9A5C00]"
                      }`}
                    >
                      {isJudged ? "Judged" : "Pending"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Main Card */}
        {currentProject && (
          <div className="relative">
            {upcomingCards.map((project, index) => (
              <div
                key={project.id}
                className={`pointer-events-none absolute inset-0 z-0 rounded-3xl border border-[#DDE4F0] bg-[#F8FAFE] px-5 py-5 shadow-sm ${
                  index === 0
                    ? "translate-y-3 scale-[0.985]"
                    : "translate-y-6 scale-[0.97]"
                }`}
              >
                <p className="truncate text-sm font-medium text-[rgba(0,0,0,0.45)]">
                  {project.project_name}
                </p>
              </div>
            ))}

            <div className="relative z-10 rounded-3xl border border-[#DDE4F0] bg-white p-4 shadow-xl md:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <h3 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.04em] text-black">
                  {currentProject.project_name}
                </h3>
                <span className="inline-flex h-8 items-center rounded-full border border-[#E2E8F3] bg-[#F8FAFD] px-3 text-xs font-semibold text-[rgba(0,0,0,0.72)]">
                  Card {currentIndex + 1} of {visibleProjects.length}
                </span>
              </div>

              <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                {/* Rubric */}
                <section className="order-2 space-y-4 lg:order-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[rgba(0,0,0,0.8)]">
                      Rubric
                    </p>
                    <span className="inline-flex h-7 items-center rounded-full bg-[#EAF2FF] px-3 text-xs font-semibold text-[#2E68CA]">
                      {currentTrackScoredCount}/
                      {currentProject.track_ids.length} tracks completed
                    </span>
                  </div>
                  <div className="space-y-3">
                    {currentProject.track_ids.map((trackId) => {
                      const trackInfo = tracks.find((t) => t.id === trackId);
                      const isScored =
                        currentProject.scored_track_ids.includes(trackId);
                      const isOpen = currentOpenTrackIds.includes(trackId);

                      return (
                        <div
                          key={trackId}
                          className={`rounded-xl border bg-white px-4 transition-colors ${
                            isOpen ? "border-[#BFD2F4]" : "border-[#D8E1F0]"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setOpenTrackIds((prev) => {
                                const current =
                                  prev[currentProject.id] ?? [
                                    currentProject.track_ids[0],
                                  ];
                                const next = isOpen
                                  ? current.filter((id) => id !== trackId)
                                  : [...current, trackId];
                                return {
                                  ...prev,
                                  [currentProject.id]: next,
                                };
                              });
                            }}
                            className="flex w-full items-center justify-between gap-2 py-3 text-left"
                          >
                            <span className="font-medium text-[rgba(0,0,0,0.8)]">
                              {trackInfo?.name || "Track"}
                            </span>
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold ${
                                  isScored
                                    ? "bg-[#E8F8EC] text-[#19703A]"
                                    : "bg-[#FFF5E5] text-[#9A5C00]"
                                }`}
                              >
                                {isScored ? "Scored" : "Pending"}
                              </span>
                              <ChevronDown
                                className={`h-4 w-4 text-gray-400 transition-transform ${
                                  isOpen ? "rotate-180" : ""
                                }`}
                              />
                            </div>
                          </button>
                          {isOpen && trackInfo && (
                            <div className="pb-4">
                              <ScoringFormUI
                                criteria={trackInfo.criteria as ScoringCriterion[]}
                                initialScores={
                                  isScored
                                    ? generateDummyScores(trackInfo.criteria as ScoringCriterion[], currentProject.id)
                                    : undefined
                                }
                                initialComments={
                                  isScored
                                    ? "Great project with solid execution. The technical implementation is impressive."
                                    : ""
                                }
                                hasExistingScore={isScored}
                                previewMode
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Snapshot */}
                <section className="order-1 min-w-0 space-y-4 lg:order-2">
                  <div className="flex h-[240px] w-full items-center justify-center rounded-2xl bg-gradient-to-br from-[#EEF4FF] via-[#F5F9FF] to-[#EDF9F3]">
                    <div className="flex flex-col items-center gap-2 text-gray-500">
                      <Scale className="h-8 w-8 text-[#4B89EF]" />
                      <p className="text-sm font-medium">
                        Project cover image
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold uppercase tracking-widest text-gray-500">
                      Snapshot
                    </h4>
                    <p className="text-sm leading-6 text-[rgba(0,0,0,0.78)]">
                      {currentProject.project_description}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <span className="inline-flex items-center rounded-full border border-[#D7DEEB] bg-white px-3 py-1.5 text-xs font-medium text-gray-600">
                        Project details
                      </span>
                      <span className="inline-flex items-center rounded-full border border-[#D7DEEB] bg-white px-3 py-1.5 text-xs font-medium text-gray-600">
                        Live demo
                      </span>
                      <span className="inline-flex items-center rounded-full border border-[#D7DEEB] bg-white px-3 py-1.5 text-xs font-medium text-gray-600">
                        Video pitch
                      </span>
                    </div>
                  </div>
                </section>
              </div>

              {/* Pagination dots */}
              <div className="mt-5 flex items-center justify-center gap-2">
                {visibleProjects.slice(0, 10).map((project) => (
                  <span
                    key={project.id}
                    className={`h-1.5 rounded-full transition-all ${
                      project.id === currentProject.id
                        ? "w-8 bg-[#2E68CA]"
                        : "w-2 bg-[#D5DEED]"
                    }`}
                  />
                ))}
              </div>
              <p className="mt-2 text-center text-xs text-gray-400">
                Use arrow buttons to navigate between projects
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

