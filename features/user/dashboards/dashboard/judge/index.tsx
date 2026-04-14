"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Project, EventTrack } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { EventSearchInput } from "@/components/ui/event-search-input";
import { DefaultScoring } from "@/components/project-scoring/default-scoring";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowLeft, ArrowRight, ChevronDown, Target } from "lucide-react";
import Link from "next/link";
import { CoverImageWithFallback } from "@/features/projects/components/displays/cover-image-with-fallback";
import { LoadingScreen } from "@/components/ui/loading-screen";
import {
  getNextProjectId,
  isProjectFullyScored,
  truncateWithEllipsis,
} from "./utils";

interface JudgeDashboardProps {
  eventId: string;
}

interface ProjectAssignmentRow {
  project_id: string;
}

interface ProjectRow {
  id: string;
  project_name: string;
  project_description: string | null;
  created_at: string;
  event_id: string;
  cover_image_url: string | null;
  project_url: string | null;
  video_url: string | null;
  project_tracks: Array<{ track_id: string }> | null;
}

interface ScoreRow {
  project_id: string;
  track_id: string;
  scores: Record<string, number> | null;
}

type NavigatorSort = "default" | "score_high" | "score_low" | "unscored_first";

/**
 * Compute the weighted average of a judge's scores for a single track.
 * Returns null if no scores exist or weights sum to zero.
 */
function computeTrackAverage(
  scores: Record<string, number> | null,
  track: EventTrack | undefined
): number | null {
  if (!scores || !track) return null;
  const criteria =
    (track.scoring_criteria as { criteria?: Array<{ id: string; weight: number }> })
      ?.criteria || [];
  if (criteria.length === 0) return null;

  let weightedSum = 0;
  let totalWeight = 0;
  for (const criterion of criteria) {
    const score = scores[criterion.id];
    if (typeof score !== "number") continue;
    const weight = criterion.weight || 0;
    weightedSum += score * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return null;
  return weightedSum / totalWeight;
}

/**
 * Compute the overall average across all tracks the judge has scored for a project.
 */
function computeProjectAverage(
  projectId: string,
  scoresMap: Map<string, Map<string, Record<string, number>>>,
  tracksById: Map<string, EventTrack>
): number | null {
  const projectScores = scoresMap.get(projectId);
  if (!projectScores || projectScores.size === 0) return null;

  const trackAverages: number[] = [];
  projectScores.forEach((scores, trackId) => {
    const track = tracksById.get(trackId);
    const avg = computeTrackAverage(scores, track);
    if (avg !== null) trackAverages.push(avg);
  });

  if (trackAverages.length === 0) return null;
  return trackAverages.reduce((a, b) => a + b, 0) / trackAverages.length;
}

export function JudgeDashboard({ eventId }: JudgeDashboardProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [eventTracks, setEventTracks] = useState<EventTrack[]>([]);
  const [scoredProjects, setScoredProjects] = useState<
    Map<string, Set<string>>
  >(new Map());
  // Stores actual numeric scores per project per track: Map<projectId, Map<trackId, scoresObject>>
  const [scoreValues, setScoreValues] = useState<
    Map<string, Map<string, Record<string, number>>>
  >(new Map());
  const [navigatorSort, setNavigatorSort] = useState<NavigatorSort>("default");
  const [judgeId, setJudgeId] = useState<string>("");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [openTracksByProject, setOpenTracksByProject] = useState<
    Map<string, string[]>
  >(new Map());
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(
    new Set()
  );
  const [isNavigatorOpen, setIsNavigatorOpen] = useState(true);
  const [deckFilter, setDeckFilter] = useState<"pending" | "all">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [finalistFeatureEnabled, setFinalistFeatureEnabled] = useState(false);
  const previousVisibleIdsRef = useRef<string[]>([]);
  const swipeStartXRef = useRef<number | null>(null);
  const swipeEnabledRef = useRef(false);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const filteredProjects = useMemo(
    () =>
      projects.filter(
        (project) =>
          project.project_name
            .toLowerCase()
            .includes(normalizedSearchQuery) ||
          (project.project_description || "")
            .toLowerCase()
            .includes(normalizedSearchQuery)
      ),
    [projects, normalizedSearchQuery]
  );

  const remainingProjects = useMemo(
    () =>
      filteredProjects.filter(
        (project) => !isProjectFullyScored(project, scoredProjects)
      ),
    [filteredProjects, scoredProjects]
  );

  const visibleProjects = useMemo(
    () => (deckFilter === "all" ? filteredProjects : remainingProjects),
    [deckFilter, filteredProjects, remainingProjects]
  );
  // Map from track_id → EventTrack for quick lookups
  const tracksById = useMemo(() => {
    const m = new Map<string, EventTrack>();
    eventTracks.forEach((t) => m.set(t.track_id, t));
    return m;
  }, [eventTracks]);

  // Average score per project (null if no scores yet)
  const averagesByProject = useMemo(() => {
    const m = new Map<string, number | null>();
    projects.forEach((p) => {
      m.set(p.id, computeProjectAverage(p.id, scoreValues, tracksById));
    });
    return m;
  }, [projects, scoreValues, tracksById]);

  // Apply sort to the visible projects for the navigator
  const navigatorProjects = useMemo(() => {
    if (navigatorSort === "default") return visibleProjects;
    const sorted = [...visibleProjects];
    sorted.sort((a, b) => {
      const avgA = averagesByProject.get(a.id);
      const avgB = averagesByProject.get(b.id);
      const hasA = avgA !== null && avgA !== undefined;
      const hasB = avgB !== null && avgB !== undefined;

      if (navigatorSort === "unscored_first") {
        if (hasA && !hasB) return 1;
        if (!hasA && hasB) return -1;
        return a.project_name.localeCompare(b.project_name);
      }
      // For score sorts, unscored projects go to the bottom
      if (!hasA && !hasB) return a.project_name.localeCompare(b.project_name);
      if (!hasA) return 1;
      if (!hasB) return -1;
      return navigatorSort === "score_high"
        ? (avgB as number) - (avgA as number)
        : (avgA as number) - (avgB as number);
    });
    return sorted;
  }, [visibleProjects, navigatorSort, averagesByProject]);
  const judgedProjectsCount = useMemo(
    () =>
      projects.filter((project) => isProjectFullyScored(project, scoredProjects))
        .length,
    [projects, scoredProjects]
  );

  const currentProject = useMemo(() => {
    if (visibleProjects.length === 0) {
      return null;
    }
    return (
      visibleProjects.find((project) => project.id === activeProjectId) ||
      visibleProjects[0]
    );
  }, [visibleProjects, activeProjectId]);

  const currentProjectIndex = useMemo(() => {
    if (!currentProject) {
      return -1;
    }
    return visibleProjects.findIndex(
      (project) => project.id === currentProject.id
    );
  }, [visibleProjects, currentProject]);

  const currentOpenTrackIds = useMemo(() => {
    if (!currentProject || currentProject.track_ids.length === 0) {
      return [];
    }

    const selectedTrackIds = openTracksByProject.get(currentProject.id);
    if (selectedTrackIds) {
      return selectedTrackIds.filter((trackId) =>
        currentProject.track_ids.includes(trackId)
      );
    }

    return [currentProject.track_ids[0]];
  }, [currentProject, openTracksByProject]);

  const currentTrackScoredCount = useMemo(() => {
    if (!currentProject) {
      return 0;
    }
    return scoredProjects.get(currentProject.id)?.size || 0;
  }, [currentProject, scoredProjects]);

  const navigateCards = useCallback(
    (direction: 1 | -1) => {
      const nextProjectId = getNextProjectId(
        visibleProjects,
        activeProjectId,
        direction
      );
      if (nextProjectId) {
        setActiveProjectId(nextProjectId);
      }
    },
    [visibleProjects, activeProjectId]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        navigateCards(-1);
      } else if (event.key === "ArrowRight") {
        navigateCards(1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigateCards]);

  const markTrackAsScored = useCallback((projectId: string, trackId: string) => {
    let updatedTrackIds = new Set<string>();
    setScoredProjects((prev) => {
      const updated = new Map(prev);
      const existingTracks = new Set(updated.get(projectId) ?? []);
      existingTracks.add(trackId);
      updated.set(projectId, existingTracks);
      updatedTrackIds = existingTracks;
      return updated;
    });
    return updatedTrackIds;
  }, []);

  const markTrackAsUnscored = useCallback(
    (projectId: string, trackId: string) => {
      setScoredProjects((prev) => {
        const updated = new Map(prev);
        const existingTracks = new Set(updated.get(projectId) ?? []);
        existingTracks.delete(trackId);

        if (existingTracks.size === 0) {
          updated.delete(projectId);
        } else {
          updated.set(projectId, existingTracks);
        }

        return updated;
      });
    },
    []
  );

  const advanceAfterTrackSubmit = useCallback(
    (project: Project, submittedTrackId: string) => {
      const updatedTrackIds = markTrackAsScored(project.id, submittedTrackId);

      const nextUnscoredTrackId = project.track_ids.find(
        (trackId) => !updatedTrackIds.has(trackId)
      );
      if (nextUnscoredTrackId) {
        setOpenTracksByProject((prev) => {
          const updated = new Map(prev);
          const existingTrackIds = updated.get(project.id) ?? [];
          if (!existingTrackIds.includes(nextUnscoredTrackId)) {
            updated.set(project.id, [...existingTrackIds, nextUnscoredTrackId]);
          }
          return updated;
        });
        return;
      }

      const currentIndex = visibleProjects.findIndex((p) => p.id === project.id);
      const candidates = visibleProjects.filter((p) => p.id !== project.id);
      if (candidates.length === 0) {
        return;
      }

      const nextIndex = currentIndex >= 0 ? Math.min(currentIndex, candidates.length - 1) : 0;
      setActiveProjectId(candidates[nextIndex].id);
    },
    [markTrackAsScored, visibleProjects]
  );

  const isInteractiveSwipeTarget = useCallback((target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return Boolean(
      target.closest(
        "button, a, input, textarea, label, [role='slider'], [data-no-swipe='true']"
      )
    );
  }, []);

  const resetSwipeState = () => {
    swipeEnabledRef.current = false;
    swipeStartXRef.current = null;
  };

  const handleCardPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    if (isInteractiveSwipeTarget(event.target)) {
      resetSwipeState();
      return;
    }

    swipeEnabledRef.current = true;
    swipeStartXRef.current = event.clientX;
  };

  const handleCardPointerUp = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    if (!swipeEnabledRef.current || swipeStartXRef.current === null) {
      resetSwipeState();
      return;
    }

    const deltaX = event.clientX - swipeStartXRef.current;
    const swipeThreshold = 100;

    if (Math.abs(deltaX) >= swipeThreshold) {
      navigateCards(deltaX > 0 ? -1 : 1);
    }

    resetSwipeState();
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Get current user's ID
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("Error fetching session:", sessionError);
          throw new Error(`Failed to fetch session: ${sessionError.message}`);
        }

        if (!session) {
          throw new Error("No active session found");
        }

        setJudgeId(session.user.id);

        const [
          trackResponse,
          eventSettingsResponse,
          assignedProjectsResponse,
        ] = await Promise.all([
          supabase
            .from("event_tracks")
            .select(
              `
              *,
              track_id,
              name,
              description,
              scoring_criteria
            `
            )
            .eq("event_id", eventId),
          supabase
            .from("events")
            .select("finalist_recommendation_enabled")
            .eq("event_id", eventId)
            .maybeSingle(),
          supabase
            .from("project_assignments")
            .select("project_id")
            .eq("user_id", session.user.id)
            .eq("event_id", eventId)
            .eq("role", "judge")
            .overrideTypes<ProjectAssignmentRow[]>(),
        ]);

        if (trackResponse.error) {
          console.error("Error fetching event tracks:", trackResponse.error);
          throw new Error(
            `Failed to fetch event tracks: ${trackResponse.error.message}`
          );
        }
        setEventTracks(trackResponse.data || []);

        setFinalistFeatureEnabled(
          !!eventSettingsResponse.data?.finalist_recommendation_enabled
        );

        if (assignedProjectsResponse.error) {
          console.error(
            "Error fetching assigned projects:",
            assignedProjectsResponse.error
          );
          throw new Error(
            `Failed to fetch assigned projects: ${assignedProjectsResponse.error.message}`
          );
        }

        const projectIds = assignedProjectsResponse.data?.map(
          (project) => project.project_id
        ) || [];

        if (projectIds.length === 0) {
          setProjects([]);
          setScoredProjects(new Map());
          return;
        }

        // Fetch projects with their tracks
        const { data: projectsData, error: projectsError } = await supabase
          .from("projects")
          .select(
            `
            id,
            project_name,
            project_description,
            created_at,
            event_id,
            cover_image_url,
            project_url,
            video_url,
            project_tracks!project_tracks_project_id_fkey (
              track_id
            )
          `
          )
          .eq("event_id", eventId)
          .eq("submitted", true)
          .in("id", projectIds)
          .overrideTypes<ProjectRow[]>();

        if (projectsError) {
          console.error("Error fetching projects:", projectsError);
          throw new Error(`Failed to fetch projects: ${projectsError.message}`);
        }

        // Group projects by their IDs with all their tracks
        const projectMap = new Map<string, Project>();
        projectsData?.forEach((project) => {
          const trackIds =
            project.project_tracks?.map((projectTrack) => projectTrack.track_id) ||
            [];
          const uniqueTrackIds = Array.from(new Set(trackIds));

          projectMap.set(project.id, {
            id: project.id,
            project_name: project.project_name,
            project_description: project.project_description || "",
            created_at: project.created_at,
            event_id: project.event_id,
            track_ids: uniqueTrackIds,
            tracks: [],
            lead_name: "",
            lead_email: "",
            teammates: [],
            cover_image_url: project.cover_image_url || undefined,
            project_url: project.project_url || undefined,
            video_url: project.video_url || undefined,
          });
        });

        const mappedProjects = Array.from(projectMap.values()).sort((a, b) =>
          a.project_name.localeCompare(b.project_name)
        );
        setProjects(mappedProjects);

        const { data: scoresData, error: scoresError } = await supabase
          .from("project_scores")
          .select("project_id, track_id, scores")
          .eq("judge_id", session.user.id)
          .eq("event_id", eventId)
          .overrideTypes<ScoreRow[]>();

        if (scoresError) {
          console.error("Error fetching scores:", scoresError);
          throw new Error(`Failed to fetch scores: ${scoresError.message}`);
        }

        const scoredMap = new Map<string, Set<string>>();
        const valuesMap = new Map<
          string,
          Map<string, Record<string, number>>
        >();
        scoresData?.forEach((score) => {
          if (!scoredMap.has(score.project_id)) {
            scoredMap.set(score.project_id, new Set());
          }
          scoredMap.get(score.project_id)?.add(score.track_id);

          if (score.scores && typeof score.scores === "object") {
            if (!valuesMap.has(score.project_id)) {
              valuesMap.set(score.project_id, new Map());
            }
            valuesMap
              .get(score.project_id)
              ?.set(score.track_id, score.scores as Record<string, number>);
          }
        });
        setScoredProjects(scoredMap);
        setScoreValues(valuesMap);
      } catch (error) {
        console.error(
          "Error fetching data:",
          error instanceof Error ? error.message : error
        );
        setProjects([]);
        setScoredProjects(new Map());
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [eventId]);

  useEffect(() => {
    setOpenTracksByProject((prev) => {
      const updated = new Map(prev);
      let hasChanges = false;

      filteredProjects.forEach((project) => {
        if (project.track_ids.length === 0) {
          if (updated.has(project.id)) {
            updated.delete(project.id);
            hasChanges = true;
          }
          return;
        }

        const openTrackIds = updated.get(project.id);
        if (!openTrackIds) {
          return;
        }

        const sanitizedTrackIds = openTrackIds.filter((trackId) =>
          project.track_ids.includes(trackId)
        );
        const isUnchanged =
          sanitizedTrackIds.length === openTrackIds.length &&
          sanitizedTrackIds.every((trackId, index) => trackId === openTrackIds[index]);

        if (!isUnchanged) {
          updated.set(project.id, sanitizedTrackIds);
          hasChanges = true;
        }
      });

      return hasChanges ? updated : prev;
    });
  }, [filteredProjects]);

  useEffect(() => {
    const visibleIds = visibleProjects.map((project) => project.id);

    if (visibleIds.length === 0) {
      if (activeProjectId !== null) {
        setActiveProjectId(null);
      }
      previousVisibleIdsRef.current = visibleIds;
      return;
    }

    if (activeProjectId && visibleIds.includes(activeProjectId)) {
      previousVisibleIdsRef.current = visibleIds;
      return;
    }

    const previousIds = previousVisibleIdsRef.current;
    const previousIndex = activeProjectId ? previousIds.indexOf(activeProjectId) : -1;
    const fallbackIndex = previousIndex >= 0
      ? Math.min(previousIndex, visibleIds.length - 1)
      : 0;

    setActiveProjectId(visibleIds[fallbackIndex]);
    previousVisibleIdsRef.current = visibleIds;
  }, [visibleProjects, activeProjectId]);

  const currentDescription = currentProject?.project_description?.trim() || "";
  const currentDescriptionIsExpanded =
    !!currentProject && expandedDescriptions.has(currentProject.id);
  const shouldTruncateDescription = currentDescription.length > 240;

  const displayDescription =
    shouldTruncateDescription && !currentDescriptionIsExpanded
      ? truncateWithEllipsis(currentDescription, 240)
      : currentDescription || "No description provided.";

  const upcomingCards =
    currentProjectIndex >= 0
      ? visibleProjects.slice(currentProjectIndex + 1, currentProjectIndex + 3)
      : [];

  if (isLoading) {
    return <LoadingScreen message="Loading projects..." />;
  }

  if (projects.length === 0) {
    return (
      <div className="w-full px-4 pb-10 pt-8 md:px-8">
        <div className="mx-auto flex max-w-[900px] flex-col items-center gap-6 rounded-3xl border border-dashed border-[#D7DCE4] bg-[#F8FAFD] px-8 py-16 text-center">
          <Target className="h-10 w-10 text-[#4B89EF]" />
          <h2 className="text-[28px] font-semibold leading-[1.3] tracking-[-0.04em] text-black">
            No projects assigned yet
          </h2>
          <p className="max-w-[540px] text-[15px] text-[rgba(0,0,0,0.68)]">
            Once organizers assign you projects, they will appear here as a swipeable judging deck.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 pb-10 pt-6 md:px-8">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6">
          <section className="p-0">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <EventSearchInput
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search project cards..."
                wrapperClassName="flex-1"
                inputClassName="h-10 text-sm"
                rightAdornment={
                  searchQuery ? (
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-xs font-medium text-[rgba(0,0,0,0.55)] transition hover:bg-[#EEF3FC] hover:text-[rgba(0,0,0,0.8)]"
                      onClick={() => setSearchQuery("")}
                    >
                      Clear
                    </button>
                  ) : undefined
                }
              />

              <div className="flex flex-wrap items-center gap-2" data-no-swipe="true">
                <div className="inline-flex h-10 items-center rounded-xl border border-[#D6DEEC] bg-[#F5F8FD] p-1">
                  <button
                    type="button"
                    className={`inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium transition ${
                      deckFilter === "pending"
                        ? "bg-white text-[#19489A] shadow-sm"
                        : "text-[rgba(0,0,0,0.62)] hover:text-[rgba(0,0,0,0.82)]"
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
                        : "text-[rgba(0,0,0,0.62)] hover:text-[rgba(0,0,0,0.82)]"
                    }`}
                    onClick={() => setDeckFilter("all")}
                  >
                    All ({filteredProjects.length})
                  </button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => navigateCards(-1)}
                  disabled={visibleProjects.length <= 1}
                  aria-label="Previous project"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => navigateCards(1)}
                  disabled={visibleProjects.length <= 1}
                  aria-label="Next project"
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </section>

          {filteredProjects.length > 0 && (
            <section className="p-0">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[rgba(0,0,0,0.82)]">
                  Project Navigator
                </p>
                <div className="flex items-center gap-2">
                  <select
                    value={navigatorSort}
                    onChange={(e) =>
                      setNavigatorSort(e.target.value as NavigatorSort)
                    }
                    className="h-8 rounded-md border border-[#D4DDEC] bg-white px-2 text-xs font-medium text-[rgba(0,0,0,0.68)] focus:outline-none focus:ring-1 focus:ring-[#4B89EF]"
                    aria-label="Sort projects"
                  >
                    <option value="default">Alphabetical</option>
                    <option value="score_high">Score: high → low</option>
                    <option value="score_low">Score: low → high</option>
                    <option value="unscored_first">Unscored first</option>
                  </select>
                  <p className="inline-flex h-7 items-center rounded-full bg-[#E8F8EC] px-2.5 text-xs font-semibold text-[#19703A]">
                    Judged {judgedProjectsCount}/{projects.length}
                  </p>
                  {isNavigatorOpen && (
                    <p className="text-xs text-[rgba(0,0,0,0.58)]">
                      Showing {navigatorProjects.length} of {projects.length}
                    </p>
                  )}
                  <button
                    type="button"
                    aria-expanded={isNavigatorOpen}
                    aria-controls="judge-project-navigator-list"
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-[#D4DDEC] bg-white px-2.5 text-xs font-medium text-[rgba(0,0,0,0.68)] transition hover:bg-[#F5F8FD]"
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
                <div
                  id="judge-project-navigator-list"
                  className="max-h-56 overflow-auto rounded-xl bg-[#FBFCFE]"
                >
                {navigatorProjects.length === 0 && (
                  <div className="px-4 py-6 text-sm text-[rgba(0,0,0,0.6)]">
                    No projects in this filter.
                    {deckFilter === "pending" && (
                      <button
                        type="button"
                        className="ml-2 font-semibold text-[#2E68CA] hover:underline"
                        onClick={() => setDeckFilter("all")}
                      >
                        Switch to All
                      </button>
                    )}
                  </div>
                )}
                {navigatorProjects.map((project, index) => {
                  const isJudged = isProjectFullyScored(project, scoredProjects);
                  const scoredTrackCount = scoredProjects.get(project.id)?.size || 0;
                  const isActive = currentProject?.id === project.id;
                  const avgScore = averagesByProject.get(project.id);
                  const projectTracks = project.track_ids
                    .map((tid) => tracksById.get(tid))
                    .filter((t): t is EventTrack => Boolean(t));

                  return (
                    <button
                      key={project.id}
                      type="button"
                      className={`flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition ${
                        index !== navigatorProjects.length - 1
                          ? "border-b border-[#E7EDF8]"
                          : ""
                      } ${
                        isActive
                          ? "bg-[#EAF2FF]"
                          : "bg-transparent hover:bg-[#F2F6FD]"
                      }`}
                      onClick={() => {
                        setActiveProjectId(project.id);
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[rgba(0,0,0,0.84)]">
                          {project.project_name}
                        </p>
                        <p className="text-xs text-[rgba(0,0,0,0.52)]">
                          Tracks scored {scoredTrackCount}/{project.track_ids.length}
                          {avgScore !== null && avgScore !== undefined && (
                            <>
                              {" · "}
                              <span className="font-semibold text-[#2E68CA]">
                                Avg {avgScore.toFixed(1)}
                              </span>
                            </>
                          )}
                        </p>
                        {projectTracks.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {projectTracks.slice(0, 3).map((t) => (
                              <span
                                key={t.track_id}
                                className="inline-flex items-center rounded-full bg-[#EEF3FB] px-2 py-0.5 text-[10px] font-medium text-[#2E68CA]"
                                title={t.name}
                              >
                                {t.name}
                              </span>
                            ))}
                            {projectTracks.length > 3 && (
                              <span className="inline-flex items-center rounded-full bg-[#F2F4F7] px-2 py-0.5 text-[10px] font-medium text-[rgba(0,0,0,0.6)]">
                                +{projectTracks.length - 3}
                              </span>
                            )}
                          </div>
                        )}
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
          )}

          {filteredProjects.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#D7DCE4] bg-[#FAFBFD] px-6 py-10 text-center text-sm text-[rgba(0,0,0,0.65)]">
              No projects match your search.
            </div>
          )}

          {filteredProjects.length > 0 &&
            deckFilter === "pending" &&
            remainingProjects.length === 0 && (
            <div className="rounded-2xl border border-[#D7E5FF] bg-[#F5F9FF] px-6 py-10 text-center">
              <h3 className="text-2xl font-semibold tracking-[-0.03em] text-black">
                You&apos;re done judging this set
              </h3>
              <p className="mt-2 text-sm text-[rgba(0,0,0,0.65)]">
                Every project in this view has already been scored.
              </p>
              <div className="mt-4">
                <Button type="button" onClick={() => setDeckFilter("all")}>
                  View Judged Projects
                </Button>
              </div>
            </div>
          )}

          {currentProject && (
            <>
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

                <div
                  className="relative z-10 rounded-3xl border border-[#DDE4F0] bg-white p-4 shadow-xl md:p-6"
                  style={{ touchAction: "pan-y" }}
                  onPointerDown={handleCardPointerDown}
                  onPointerUp={handleCardPointerUp}
                  onPointerCancel={resetSwipeState}
                  onPointerLeave={resetSwipeState}
                >
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="mt-1 text-[30px] font-semibold leading-[1.1] tracking-[-0.06em] text-black">
                        <Link
                          href={`/projects/public/${currentProject.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline-offset-4 hover:text-[#2E68CA] hover:underline"
                          data-no-swipe="true"
                        >
                          {currentProject.project_name}
                        </Link>
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex h-8 items-center rounded-full border border-[#E2E8F3] bg-[#F8FAFD] px-3 text-xs font-semibold text-[rgba(0,0,0,0.72)]">
                        Card {currentProjectIndex + 1} of {visibleProjects.length}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                    {/* Snapshot — shown in both mobile & desktop inside the card */}
                    <section className="order-1 min-w-0 space-y-4 lg:order-2">
                      <div className="overflow-hidden rounded-2xl bg-white">
                        {currentProject.cover_image_url ? (
                          <CoverImageWithFallback
                            src={currentProject.cover_image_url}
                            alt={`${currentProject.project_name} cover`}
                            className="h-[240px] w-full object-cover md:h-[280px]"
                          />
                        ) : (
                          <div className="flex h-[240px] w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#EEF4FF] via-[#F5F9FF] to-[#EDF9F3] text-[rgba(0,0,0,0.6)] md:h-[280px]">
                            <Target className="h-8 w-8 text-[#4B89EF]" />
                            <p className="text-sm font-medium">No project image uploaded</p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-[rgba(0,0,0,0.5)]">
                          Snapshot
                        </h4>
                        <p className="break-words text-sm leading-6 text-[rgba(0,0,0,0.78)]">
                          {displayDescription}
                        </p>
                        {shouldTruncateDescription && (
                          <button
                            type="button"
                            data-no-swipe="true"
                            className="text-sm font-semibold text-[#2E68CA] hover:underline"
                            onClick={() =>
                              setExpandedDescriptions((prev) => {
                                if (!currentProject) {
                                  return prev;
                                }
                                const updated = new Set(prev);
                                if (updated.has(currentProject.id)) {
                                  updated.delete(currentProject.id);
                                } else {
                                  updated.add(currentProject.id);
                                }
                                return updated;
                              })
                            }
                          >
                            {currentDescriptionIsExpanded ? "Show less" : "Show more"}
                          </button>
                        )}

                        <div className="flex flex-wrap gap-2 pt-2" data-no-swipe="true">
                          <Link
                            href={`/projects/public/${currentProject.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center rounded-full border border-[#D7DEEB] bg-white px-3 py-1.5 text-xs font-medium text-[rgba(0,0,0,0.72)] hover:border-[#AEB8CF]"
                          >
                            Project details
                          </Link>
                          {currentProject.project_url && (
                            <Link
                              href={currentProject.project_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center rounded-full border border-[#D7DEEB] bg-white px-3 py-1.5 text-xs font-medium text-[rgba(0,0,0,0.72)] hover:border-[#AEB8CF]"
                            >
                              Live demo
                            </Link>
                          )}
                          {currentProject.video_url && (
                            <Link
                              href={currentProject.video_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center rounded-full border border-[#D7DEEB] bg-white px-3 py-1.5 text-xs font-medium text-[rgba(0,0,0,0.72)] hover:border-[#AEB8CF]"
                            >
                              Video pitch
                            </Link>
                          )}
                        </div>
                      </div>
                    </section>

                    {/* Rubric — desktop only (inside card) */}
                    <section className="order-2 hidden space-y-4 lg:order-1 lg:block">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[rgba(0,0,0,0.8)]">
                          Rubric
                        </p>
                        <p className="inline-flex h-7 items-center rounded-full bg-[#EAF2FF] px-3 text-xs font-semibold text-[#2E68CA]">
                          {currentTrackScoredCount}/{currentProject.track_ids.length} tracks completed
                        </p>
                      </div>

                      {currentProject.track_ids.length === 0 ? (
                        <p className="text-sm text-yellow-700">
                          This project has no track assigned yet.
                        </p>
                      ) : (
                        <Accordion
                          type="multiple"
                          value={currentOpenTrackIds}
                          onValueChange={(value) => {
                            setOpenTracksByProject((prev) => {
                              const updated = new Map(prev);
                              updated.set(currentProject.id, value);
                              return updated;
                            });
                          }}
                          className="space-y-3"
                        >
                          {currentProject.track_ids.map((trackId) => {
                            const trackInfo = eventTracks.find(
                              (track) => track.track_id === trackId
                            );
                            const isScored =
                              scoredProjects.get(currentProject.id)?.has(trackId) ||
                              false;
                            const isOpen = currentOpenTrackIds.includes(trackId);

                            return (
                              <AccordionItem
                                key={trackId}
                                value={trackId}
                                className="rounded-xl border border-[#D8E1F0] bg-white px-4 data-[state=open]:border-[#BFD2F4]"
                              >
                                <AccordionTrigger
                                  data-no-swipe="true"
                                  className="py-3 hover:no-underline"
                                >
                                  <div className="flex w-full items-center justify-between gap-2 pr-3 text-left">
                                    <span className="font-medium text-[rgba(0,0,0,0.8)]">
                                      {trackInfo?.name || "Track"}
                                    </span>
                                    <span
                                      className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold ${
                                        isScored
                                          ? "bg-[#E8F8EC] text-[#19703A]"
                                          : "bg-[#FFF5E5] text-[#9A5C00]"
                                      }`}
                                    >
                                      {isScored ? "Scored" : "Pending"}
                                    </span>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="pb-3">
                                  {isOpen && (
                                    <DefaultScoring
                                      key={`${currentProject.id}-${trackId}`}
                                      projectId={currentProject.id}
                                      eventId={eventId}
                                      judgeId={judgeId}
                                      trackId={trackId}
                                      finalistFeatureEnabled={finalistFeatureEnabled}
                                      hideProjectHeader
                                      onScoreSaved={() =>
                                        advanceAfterTrackSubmit(currentProject, trackId)
                                      }
                                      onScoreDeleted={() =>
                                        markTrackAsUnscored(currentProject.id, trackId)
                                      }
                                    />
                                  )}
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                        </Accordion>
                      )}
                    </section>
                  </div>

                  <div className="mt-5 flex items-center justify-center gap-2">
                    {visibleProjects.slice(0, 10).map((project, index) => (
                      <span
                        key={project.id}
                        className={`h-1.5 rounded-full transition-all ${
                          project.id === currentProject.id
                            ? "w-8 bg-[#2E68CA]"
                            : "w-2 bg-[#D5DEED]"
                        } ${
                          index === 9 && visibleProjects.length > 10
                            ? "opacity-60"
                            : ""
                        }`}
                      />
                    ))}
                  </div>
                  <p className="mt-2 text-center text-xs text-[rgba(0,0,0,0.52)] lg:hidden">
                    Swipe left or right to move between projects.
                  </p>
                  <p className="mt-2 hidden text-center text-xs text-[rgba(0,0,0,0.52)] lg:block">
                    Use arrow keys or swipe to move between projects.
                  </p>
                </div>
              </div>

              {/* Rubric — mobile only (outside card) */}
              <section className="mt-6 space-y-4 lg:hidden">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[rgba(0,0,0,0.8)]">
                    Rubric
                  </p>
                  <p className="inline-flex h-7 items-center rounded-full bg-[#EAF2FF] px-3 text-xs font-semibold text-[#2E68CA]">
                    {currentTrackScoredCount}/{currentProject.track_ids.length} tracks completed
                  </p>
                </div>

                {currentProject.track_ids.length === 0 ? (
                  <p className="text-sm text-yellow-700">
                    This project has no track assigned yet.
                  </p>
                ) : (
                  <Accordion
                    type="multiple"
                    value={currentOpenTrackIds}
                    onValueChange={(value) => {
                      setOpenTracksByProject((prev) => {
                        const updated = new Map(prev);
                        updated.set(currentProject.id, value);
                        return updated;
                      });
                    }}
                    className="space-y-3"
                  >
                    {currentProject.track_ids.map((trackId) => {
                      const trackInfo = eventTracks.find(
                        (track) => track.track_id === trackId
                      );
                      const isScored =
                        scoredProjects.get(currentProject.id)?.has(trackId) ||
                        false;
                      const isOpen = currentOpenTrackIds.includes(trackId);

                      return (
                        <AccordionItem
                          key={trackId}
                          value={trackId}
                          className="rounded-xl border border-[#D8E1F0] bg-white px-4 data-[state=open]:border-[#BFD2F4]"
                        >
                          <AccordionTrigger
                            data-no-swipe="true"
                            className="py-3 hover:no-underline"
                          >
                            <div className="flex w-full items-center justify-between gap-2 pr-3 text-left">
                              <span className="font-medium text-[rgba(0,0,0,0.8)]">
                                {trackInfo?.name || "Track"}
                              </span>
                              <span
                                className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold ${
                                  isScored
                                    ? "bg-[#E8F8EC] text-[#19703A]"
                                    : "bg-[#FFF5E5] text-[#9A5C00]"
                                }`}
                              >
                                {isScored ? "Scored" : "Pending"}
                              </span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-3">
                            {isOpen && (
                              <DefaultScoring
                                key={`${currentProject.id}-${trackId}-mobile`}
                                projectId={currentProject.id}
                                eventId={eventId}
                                judgeId={judgeId}
                                trackId={trackId}
                                finalistFeatureEnabled={finalistFeatureEnabled}
                                hideProjectHeader
                                onScoreSaved={() =>
                                  advanceAfterTrackSubmit(currentProject, trackId)
                                }
                                onScoreDeleted={() =>
                                  markTrackAsUnscored(currentProject.id, trackId)
                                }
                              />
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                )}
              </section>
            </>
          )}
      </div>
    </div>
  );
}
