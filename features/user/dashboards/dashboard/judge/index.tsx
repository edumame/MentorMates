"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Project, EventTrack } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EventSearchInput } from "@/components/ui/event-search-input";
import { DefaultScoring } from "@/components/project-scoring/default-scoring";
import { ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { LoadingScreen } from "@/components/ui/loading-screen";

interface JudgeDashboardProps {
  eventId: string;
}

export function JudgeDashboard({ eventId }: JudgeDashboardProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [eventTracks, setEventTracks] = useState<EventTrack[]>([]);
  const [scoredProjects, setScoredProjects] = useState<
    Map<string, Set<string>>
  >(new Map());
  const [judgeId, setJudgeId] = useState<string>("");
  const [showScoringComponents, setShowScoringComponents] = useState<
    Map<string, boolean>
  >(new Map());
  const [searchQuery, setSearchQuery] = useState("");
  const [finalistFeatureEnabled, setFinalistFeatureEnabled] = useState(false);

  const filteredProjects = useMemo(
    () =>
      projects.filter(
        (project) =>
          project.project_name
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          project.project_description
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
      ),
    [projects, searchQuery]
  );

  // Helper function to generate a unique key for track visibility
  const getTrackKey = (projectId: string, trackId: string) =>
    `${projectId}-${trackId}`;

  const toggleTrackScoring = (projectId: string, trackId: string) => {
    setShowScoringComponents((prev) => {
      const newMap = new Map(prev);
      const key = getTrackKey(projectId, trackId);
      newMap.set(key, !prev.get(key));
      return newMap;
    });
  };

  useEffect(() => {
    const fetchData = async () => {
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

        // Fetch event tracks and event settings
        const { data: trackData, error: trackError } = await supabase
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
          .eq("event_id", eventId);

        if (trackError) {
          console.error("Error fetching event tracks:", trackError);
          throw new Error(
            `Failed to fetch event tracks: ${trackError.message}`
          );
        }
        setEventTracks(trackData || []);

        const { data: eventSettings } = await supabase
          .from("events")
          .select("finalist_recommendation_enabled")
          .eq("event_id", eventId)
          .maybeSingle();
        setFinalistFeatureEnabled(
          !!eventSettings?.finalist_recommendation_enabled
        );

        //Fetch projects assigned to the judge
        const { data: assignedProjects, error: assignedProjectsError } =
          await supabase
            .from("project_assignments")
            .select("project_id")
            .eq("user_id", session.user.id)
            .eq("event_id", eventId);

        if (assignedProjectsError) {
          console.error(
            "Error fetching assigned projects:",
            assignedProjectsError
          );
          throw new Error(
            `Failed to fetch assigned projects: ${assignedProjectsError.message}`
          );
        }

        const projectIds = assignedProjects?.map(
          (project) => project.project_id
        );

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
            project_tracks!project_tracks_project_id_fkey (
              track_id
            )
          `
          )
          .eq("event_id", eventId)
          .eq("submitted", true)
          .in("id", projectIds);

        if (projectsError) {
          console.error("Error fetching projects:", projectsError);
          throw new Error(`Failed to fetch projects: ${projectsError.message}`);
        }

        // Group projects by their IDs with all their tracks
        const projectMap = new Map<string, Project>();
        projectsData?.forEach(
          (project: {
            id: string;
            project_name: string;
            project_description: string;
            created_at: string;
            event_id: string;
            project_tracks: Array<{ track_id: string }> | null;
          }) => {
            const trackIds =
              project.project_tracks?.map((pt) => pt.track_id) || [];
            projectMap.set(project.id, {
              id: project.id,
              project_name: project.project_name,
              project_description: project.project_description,
              created_at: project.created_at,
              event_id: project.event_id,
              track_ids: trackIds,
              tracks: [],
              lead_name: "", // These fields are required by the Project type
              lead_email: "", // but not needed for the judge dashboard
              teammates: [],
            });
          }
        );

        setProjects(Array.from(projectMap.values()));

        // Fetch current user's scores
        if (session) {
          const { data: scoresData, error: scoresError } = await supabase
            .from("project_scores")
            .select(
              `
              project_id,
              track_id,
              scores,
              comments,
              projects!project_scores_project_id_fkey!inner (
                event_id
              )
            `
            )
            .eq("judge_id", session.user.id)
            .eq("projects.event_id", eventId);

          if (scoresError) {
            console.error("Error fetching scores:", scoresError);
            throw new Error(`Failed to fetch scores: ${scoresError.message}`);
          }

          if (scoresData) {
            // Create a map of project_id -> Set of scored track_ids
            const scoredMap = new Map<string, Set<string>>();

            scoresData.forEach((score) => {
              if (!scoredMap.has(score.project_id)) {
                scoredMap.set(score.project_id, new Set());
              }
              scoredMap.get(score.project_id)?.add(score.track_id);
            });

            setScoredProjects(scoredMap);
          }
        }
      } catch (error) {
        console.error(
          "Error fetching data:",
          error instanceof Error ? error.message : error
        );
        // You might want to set an error state here to display to the user
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
    };

    fetchData();
  }, [eventId]);

  // Helper function to get the appropriate scoring component based on track's judging mode
  const getScoringComponent = (projectId: string, trackId: string) => {
    const trackInfo = eventTracks.find((t) => t.track_id === trackId);

    if (!trackInfo || !trackInfo.scoring_criteria) {
      return (
        <p className="text-yellow-600">
          Scoring criteria not configured for this track.
        </p>
      );
    }

    return (
      <DefaultScoring
        projectId={projectId}
        eventId={eventId}
        judgeId={judgeId}
        trackId={trackId}
        finalistFeatureEnabled={finalistFeatureEnabled}
        onScoreSaved={() => {
          setScoredProjects((prev) => {
            const updated = new Map(prev);
            const existingTracks = new Set(updated.get(projectId) ?? []);
            existingTracks.add(trackId);
            updated.set(projectId, existingTracks);
            return updated;
          });
          setShowScoringComponents((prev) => {
            const updated = new Map(prev);
            updated.set(getTrackKey(projectId, trackId), false);
            return updated;
          });
        }}
      />
    );
  };

  if (isLoading) {
    return <LoadingScreen message="Loading projects..." />;
  }

  if (projects.length === 0) {
    return (
      <div className="w-full px-[32px] pt-[24px]">
        <div className="flex flex-col gap-[48px] max-w-[1064px] mx-auto">
          <h2 className="text-[28px] font-semibold leading-[1.4] tracking-[-0.06em] text-black text-center">
            No projects assigned to you.
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-[32px] pt-[24px]">
      <div className="flex flex-col gap-[48px] max-w-[1064px] mx-auto">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 mb-4">
              <EventSearchInput
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                inputClassName="text-sm sm:text-sm"
              />
            </div>
            {filteredProjects.length === 0 ? (
              <p>No projects match your search.</p>
            ) : (
              <div className="space-y-4">
                {filteredProjects.map((project) => {
                  const hasAnyTrackOpen = project.track_ids.some((trackId) =>
                    showScoringComponents.get(getTrackKey(project.id, trackId))
                  );

                  return (
                    <div key={project.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">
                          <Link
                            href={`/projects/public/${project.id}`}
                            className="text-blue-500 hover:text-blue-600"
                          >
                            {project.project_name}
                          </Link>
                        </h3>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setShowScoringComponents((prev) => {
                                const newMap = new Map(prev);
                                const nextVisibility = !hasAnyTrackOpen;

                                project.track_ids.forEach((trackId) => {
                                  newMap.set(
                                    getTrackKey(project.id, trackId),
                                    nextVisibility
                                  );
                                });

                                return newMap;
                              })
                            }
                          >
                            {hasAnyTrackOpen ? (
                              <>
                                <ChevronUp className="h-4 w-4 mr-1" />
                                Hide Scoring
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-4 w-4 mr-1" />
                                Show Scoring
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                      {project.track_ids.map((trackId) => {
                        const trackInfo = eventTracks.find(
                          (t) => t.track_id === trackId
                        );
                        const isScored = scoredProjects
                          .get(project.id)
                          ?.has(trackId);
                        const isTrackOpen = !!showScoringComponents.get(
                          getTrackKey(project.id, trackId)
                        );

                        return (
                          <div key={trackId} className="mb-4">
                            <button
                              type="button"
                              className="w-full flex items-center justify-between gap-2 mb-2 text-left hover:opacity-90"
                              onClick={() =>
                                toggleTrackScoring(project.id, trackId)
                              }
                            >
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">
                                  {trackInfo?.name || "Unknown Track"}
                                </h4>
                                <span
                                  className={`px-2 py-1 text-xs rounded-full ${
                                    isScored
                                      ? "bg-green-100 text-green-800"
                                      : "bg-yellow-100 text-yellow-800"
                                  }`}
                                >
                                  {isScored ? "Scored" : "Not Scored"}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {isTrackOpen ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </div>
                            </button>
                            {isTrackOpen &&
                              getScoringComponent(project.id, trackId)}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
