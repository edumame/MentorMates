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
import { ArrowLeft, ArrowRight, Target, Trophy } from "lucide-react";
import Link from "next/link";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { Progress } from "@/components/ui/progress";
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
}

export function JudgeDashboard({ eventId }: JudgeDashboardProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [eventTracks, setEventTracks] = useState<EventTrack[]>([]);
  const [scoredProjects, setScoredProjects] = useState<
    Map<string, Set<string>>
  >(new Map());
  const [judgeId, setJudgeId] = useState<string>("");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeTrackByProject, setActiveTrackByProject] = useState<
    Map<string, string>
  >(new Map());
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(
    new Set()
  );
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

  const completedProjectCount = useMemo(
    () =>
      projects.reduce(
        (count, project) =>
          count + (isProjectFullyScored(project, scoredProjects) ? 1 : 0),
        0
      ),
    [projects, scoredProjects]
  );

  const remainingProjects = useMemo(
    () =>
      filteredProjects.filter(
        (project) => !isProjectFullyScored(project, scoredProjects)
      ),
    [filteredProjects, scoredProjects]
  );

  const judgedProjects = useMemo(
    () =>
      filteredProjects.filter((project) =>
        isProjectFullyScored(project, scoredProjects)
      ),
    [filteredProjects, scoredProjects]
  );

  const visibleProjects = useMemo(
    () => (deckFilter === "all" ? filteredProjects : remainingProjects),
    [deckFilter, filteredProjects, remainingProjects]
  );
  const navigatorProjects = visibleProjects;

  const completionPercentage = useMemo(() => {
    if (projects.length === 0) {
      return 0;
    }
    return Math.round((completedProjectCount / projects.length) * 100);
  }, [projects.length, completedProjectCount]);

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

  const currentTrackId = useMemo(() => {
    if (!currentProject || currentProject.track_ids.length === 0) {
      return null;
    }
    const selectedTrackId = activeTrackByProject.get(currentProject.id);
    if (selectedTrackId && currentProject.track_ids.includes(selectedTrackId)) {
      return selectedTrackId;
    }
    return currentProject.track_ids[0];
  }, [currentProject, activeTrackByProject]);

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

  const markTrackAsScored = useCallback((projectId: string, trackId: string) => {
    setScoredProjects((prev) => {
      const updated = new Map(prev);
      const existingTracks = new Set(updated.get(projectId) ?? []);
      existingTracks.add(trackId);
      updated.set(projectId, existingTracks);
      return updated;
    });
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
          .select("project_id, track_id")
          .eq("judge_id", session.user.id)
          .eq("event_id", eventId)
          .overrideTypes<ScoreRow[]>();

        if (scoresError) {
          console.error("Error fetching scores:", scoresError);
          throw new Error(`Failed to fetch scores: ${scoresError.message}`);
        }

        const scoredMap = new Map<string, Set<string>>();
        scoresData?.forEach((score) => {
          if (!scoredMap.has(score.project_id)) {
            scoredMap.set(score.project_id, new Set());
          }
          scoredMap.get(score.project_id)?.add(score.track_id);
        });
        setScoredProjects(scoredMap);
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
    setActiveTrackByProject((prev) => {
      const updated = new Map(prev);
      let hasChanges = false;

      filteredProjects.forEach((project) => {
        if (project.track_ids.length === 0) {
          return;
        }

        const selectedTrack = updated.get(project.id);
        if (!selectedTrack || !project.track_ids.includes(selectedTrack)) {
          updated.set(project.id, project.track_ids[0]);
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

  const currentProjectIsJudged = currentProject
    ? isProjectFullyScored(currentProject, scoredProjects)
    : false;

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
          <section className="rounded-3xl border border-[#D7E5FF] bg-gradient-to-r from-[#EEF4FF] via-[#F7FAFF] to-[#EEFBF4] p-5 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#4B89EF]">
                  Judge Progress
                </p>
                <h2 className="mt-1 text-[28px] font-semibold leading-[1.2] tracking-[-0.05em] text-black">
                  {completedProjectCount} of {projects.length} projects judged
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#CCE5D6] bg-[#EDFAF2] px-4 py-2 text-sm font-medium text-[#196A3A]">
                  <Trophy className="h-4 w-4" />
                  {projects.length - completedProjectCount} left
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <Progress value={completionPercentage} className="h-2.5 bg-white/90" />
              <p className="text-xs font-medium text-[rgba(0,0,0,0.55)]">
                {completionPercentage}% complete
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-[#E5E9F1] bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <EventSearchInput
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search project cards..."
                wrapperClassName="flex-1"
                inputClassName="h-11 text-sm"
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
                <div className="inline-flex items-center rounded-xl border border-[#D6DEEC] bg-[#F5F8FD] p-1">
                  <button
                    type="button"
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
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
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
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
            <section className="rounded-2xl border border-[#E5E9F1] bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[rgba(0,0,0,0.82)]">
                  Project Navigator
                </p>
                <p className="text-xs text-[rgba(0,0,0,0.58)]">
                  Showing {navigatorProjects.length} of {projects.length}
                </p>
              </div>

              <div className="max-h-56 overflow-auto rounded-xl border border-[#E1E8F4] bg-[#FBFCFE]">
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
                  return (
                    <button
                      key={project.id}
                      type="button"
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition ${
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
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[rgba(0,0,0,0.84)]">
                          {project.project_name}
                        </p>
                        <p className="text-xs text-[rgba(0,0,0,0.52)]">
                          Tracks scored {scoredTrackCount}/{project.track_ids.length}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
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

          {deckFilter === "all" && judgedProjects.length > 0 && (
            <p className="text-sm text-[rgba(0,0,0,0.62)]">Showing all assigned projects.</p>
          )}

          {currentProject && (
            <div className="relative min-h-[640px]">
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
                        className="underline-offset-4 hover:text-[#2E68CA] hover:underline"
                        data-no-swipe="true"
                      >
                        {currentProject.project_name}
                      </Link>
                    </h3>
                  </div>
                  <div className="rounded-full border border-[#E2E8F3] bg-[#F8FAFD] px-4 py-2 text-sm font-medium text-[rgba(0,0,0,0.72)]">
                    Card {currentProjectIndex + 1} of {visibleProjects.length}
                  </div>
                </div>

                <div className="mb-4 flex justify-end">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      currentProjectIsJudged
                        ? "bg-[#E8F8EC] text-[#19703A]"
                        : "bg-[#FFF5E5] text-[#9A5C00]"
                    }`}
                  >
                    {currentProjectIsJudged ? "Judged" : "Pending"}
                  </span>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                  <section className="rounded-2xl border border-[#E4EAF4] bg-[#FCFDFF] p-4 md:p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[rgba(0,0,0,0.8)]">
                        Rubric
                      </p>
                      <p className="rounded-full bg-[#EAF2FF] px-3 py-1 text-xs font-semibold text-[#2E68CA]">
                        {currentTrackScoredCount}/{currentProject.track_ids.length} tracks completed
                      </p>
                    </div>

                    {currentProject.track_ids.length === 0 ? (
                      <p className="text-sm text-yellow-700">
                        This project has no track assigned yet.
                      </p>
                    ) : (
                      <Accordion
                        type="single"
                        collapsible
                        value={currentTrackId || undefined}
                        onValueChange={(value) => {
                          if (!value) {
                            return;
                          }
                          setActiveTrackByProject((prev) => {
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
                          const isOpen = currentTrackId === trackId;

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
                                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
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
                                      markTrackAsScored(currentProject.id, trackId)
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

                  <section className="rounded-2xl border border-[#E4EAF4] bg-[#F8FBFF] p-4 md:p-5">
                    <div className="mb-4 overflow-hidden rounded-2xl border border-[#DCE6F7] bg-white">
                      {currentProject.cover_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
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
                      <p className="text-sm leading-6 text-[rgba(0,0,0,0.78)]">
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
                <p className="mt-2 text-center text-xs text-[rgba(0,0,0,0.52)]">
                  Swipe left or right on open card areas to move between projects.
                </p>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
