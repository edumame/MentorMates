import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Project, EventTrack } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DefaultScoring } from "@/components/project-scoring/default-scoring";

interface JudgeDashboardProps {
  eventId: string;
}

interface ProjectScore {
  scores: Record<string, number | string>;
  comments: string;
}

export function JudgeDashboard({ eventId }: JudgeDashboardProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [eventTracks, setEventTracks] = useState<EventTrack[]>([]);
  const [scoredProjects, setScoredProjects] = useState<
    Map<string, Set<string>>
  >(new Map());
  const [projectScores, setProjectScores] = useState<Map<string, ProjectScore>>(
    new Map()
  );
  const [editingScore, setEditingScore] = useState<{
    projectId: string;
    trackId: string;
  } | null>(null);
  const [judgeId, setJudgeId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

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

        // Fetch event tracks
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
            project_tracks!project_tracks_project_id_fkey!inner (
              track_id
            )
          `
          )
          .eq("event_id", eventId);

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
            project_tracks: Array<{ track_id: string }>;
          }) => {
            const trackIds = project.project_tracks.map((pt) => pt.track_id);
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
            const scoresMap = new Map<string, ProjectScore>();

            scoresData.forEach((score) => {
              if (!scoredMap.has(score.project_id)) {
                scoredMap.set(score.project_id, new Set());
              }
              scoredMap.get(score.project_id)?.add(score.track_id);

              // Store the actual scores
              const key = `${score.project_id}-${score.track_id}`;
              scoresMap.set(key, {
                scores: score.scores,
                comments: score.comments || "",
              });
            });

            setScoredProjects(scoredMap);
            setProjectScores(scoresMap);
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
    />
    );
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Judge Dashboard</h2>
      </div>

      <div>
        <Input
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {filteredProjects.length === 0 ? (
        <p>No projects match your search.</p>
      ) : (
        filteredProjects.map((project) => {
          const trackInfos = project.track_ids
            .map((id) => eventTracks.find((t) => t.track_id === id))
            .filter(Boolean) as EventTrack[];

        return (
          <Card key={project.id} className="space-y-4">
            <CardHeader>
              <CardTitle>{project.project_name}</CardTitle>
              <p className="text-sm text-gray-600">{project.project_description}</p>
            </CardHeader>
            <CardContent>
              {trackInfos.length === 0 ? (
                <p>This project has not been assigned to any tracks yet.</p>
              ) : (
                <div className="space-y-6">
                  {trackInfos.map((track) => {
                    const scored = scoredProjects
                      .get(project.id)
                      ?.has(track.track_id);
                    const scoreKey = `${project.id}-${track.track_id}`;
                    const projectScore = projectScores.get(scoreKey);
                    const isEditing =
                      editingScore?.projectId === project.id &&
                      editingScore?.trackId === track.track_id;

                    return (
                      <div key={track.track_id} className="border-t pt-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold">
                              <span className="text-blue-600">{track.name}</span>
                            </h4>
                            <p className="text-sm text-gray-600">
                              {track.description}
                            </p>
                          </div>
                          {scored && (
                            <Button
                              variant="outline"
                              onClick={() =>
                                setEditingScore(
                                  isEditing
                                    ? null
                                    : { projectId: project.id, trackId: track.track_id }
                                )
                              }
                            >
                              {isEditing ? "Cancel Edit" : "Edit Score"}
                            </Button>
                          )}
                        </div>
                        {scored ? (
                          isEditing ? (
                            getScoringComponent(project.id, track.track_id)
                          ) : projectScore ? (
                            <div className="space-y-2 mt-2">
                              <div className="grid grid-cols-2 gap-4">
                                {Object.entries(projectScore.scores).map(
                                  ([criterionId, score]) => {
                                    const criterion = track.scoring_criteria?.criteria.find(
                                      (c) => c.id === criterionId
                                    );
                                    return (
                                      <div key={criterionId} className="text-sm">
                                        <span className="font-medium">
                                          {criterion?.name}:{" "}
                                        </span>
                                        <span className="text-gray-600">{score}</span>
                                      </div>
                                    );
                                  }
                                )}
                              </div>

                              {projectScore.comments && (
                                <div className="mt-2">
                                  <p className="text-sm font-medium">Comments:</p>
                                  <p className="text-sm text-gray-600">
                                    {projectScore.comments}
                                  </p>
                                </div>
                              )}
                            </div>
                          ) : null
                        ) : (
                          getScoringComponent(project.id, track.track_id)
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })
      )
    </div>
  );
}
