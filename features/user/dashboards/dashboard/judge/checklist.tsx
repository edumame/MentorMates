import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, Clock } from "lucide-react";

interface Project {
  id: string;
  project_name: string;
  project_description: string | null;
  track_ids: string[];
}

interface truncatedProjectAssignment {
  project_id: string;
  projects: {
    project_name: string;
    project_description: string | null;
    project_tracks: {
      track_id: string;
    }[];
  };
}

interface JudgeChecklistProps {
  eventId: string;
}

export function JudgeChecklist({ eventId }: JudgeChecklistProps) {
  const [assignedProjects, setAssignedProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scoredProjects, setScoredProjects] = useState<
    Map<string, Set<string>>
  >(new Map());

  useEffect(() => {
    const fetchAssignedProjects = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        // Fetch projects assigned to the judge
        const { data: assignments, error: assignmentsError } = await supabase
          .from("project_assignments")
          .select(
            `
            project_id,
            projects (
              project_name,
              project_description,
              project_tracks (
                track_id
              )
            )
          `
          )
          .eq("user_id", session.user.id)
          .eq("event_id", eventId)
          .eq("role", "judge")
          .overrideTypes<truncatedProjectAssignment[]>();

        if (assignmentsError) throw assignmentsError;

        // Flatten the data into the Project format
        const projects = assignments.map(
          (assignment) => ({
            id: assignment.project_id,
            project_name: assignment.projects.project_name || "",
            project_description: assignment.projects.project_description,
            track_ids: assignment.projects.project_tracks.map(
              (pt) => pt.track_id
            ),
          })
        );

        setAssignedProjects(projects);

        // Fetch scored projects
        const { data: scores, error: scoresError } = await supabase
          .from("project_scores")
          .select("project_id, track_id")
          .eq("judge_id", session.user.id)
          .eq("event_id", eventId);

        if (scoresError) throw scoresError;

        // Create a map of project_id -> Set of scored track_ids
        const scoredMap = new Map<string, Set<string>>();
        scores?.forEach((score) => {
          if (!scoredMap.has(score.project_id)) {
            scoredMap.set(score.project_id, new Set());
          }
          scoredMap.get(score.project_id)?.add(score.track_id);
        });

        setScoredProjects(scoredMap);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching assigned projects:", error);
        setIsLoading(false);
      }
    };

    fetchAssignedProjects();
  }, [eventId]);

  const isProjectFullyScored = (project: Project) => {
    const scoredTracks = scoredProjects.get(project.id);
    return (
      scoredTracks &&
      project.track_ids.every((trackId) => scoredTracks.has(trackId))
    );
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Loading assigned projects...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (assignedProjects.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Project Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            No projects have been assigned to you yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Project Checklist</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-12rem)] pr-4">
          <div className="space-y-4">
            {assignedProjects.map((project) => {
              const isScored = isProjectFullyScored(project);
              return (
                <div
                  key={project.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                >
                  <div
                    className={`mt-1 p-1 rounded-full ${isScored ? "bg-green-100" : "bg-yellow-100"}`}
                  >
                    {isScored ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Clock className="h-4 w-4 text-yellow-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">
                      {project.project_name}
                    </h4>
                    {project.project_description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {project.project_description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {isScored
                        ? "All tracks scored"
                        : `${scoredProjects.get(project.id)?.size || 0}/${project.track_ids.length} tracks scored`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
