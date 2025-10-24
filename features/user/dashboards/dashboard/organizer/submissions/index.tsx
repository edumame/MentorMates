"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Papa from "papaparse";
import { supabase } from "@/lib/supabase";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { Loader2 } from "lucide-react";

interface ProjectData {
  id: string;
  project_name: string;
  lead_name: string;
  lead_email: string;
  project_description: string;
  teammates: string[];
  project_url: string | null;
  additional_materials_url: string | null;
  cover_image_url: string | null;
  event_id: string;
  created_at: string;
  submitted: boolean;
  project_tracks: {
    event_tracks: {
      track_id: string;
      name: string;
    };
  }[];
  feedback: {
    feedback_text: string;
    mentor_name: string;
    mentor_email: string;
  }[];
}

interface SubmissionsTabProps {
  eventId: string;
}

export function SubmissionsTab({ eventId }: SubmissionsTabProps) {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);

  const exportSubmissions = async () => {
    const data = projects;

    if (data) {
      const csv = Papa.unparse(
        data?.map((project) => ({
          "Project Name": project.project_name,
          "Lead Name": project.lead_name,
          "Lead Email": project.lead_email,
          Description: project.project_description,
          "Project URL": project.project_url,
          "Team Members": project.teammates.join(", "),
          "Tracks":
            project.project_tracks
              ?.map((pt) => pt.event_tracks?.name)
              .filter(Boolean)
              .join(", ") || "No tracks",
          "Submitted": project.submitted,
          "Created At": project.created_at,
        }))
      );

      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `submissions-${eventId}.csv`;
      a.click();
    }
  };

  const exportFeedback = async () => {
    // Create a flattened array where each feedback gets its own row
    const feedbackRows = projects.flatMap((project) => {
      // If no feedback, do not include the project in the export
      if (!project.feedback || project.feedback.length === 0) {
        return [];
      }

      // Create a row for each feedback item
      return project.feedback.map((fb) => ({
        "Project Name": project.project_name,
        "Project ID": project.id,
        "Lead Name": project.lead_name,
        "Lead Email": project.lead_email,
        "Project URL": project.project_url,
        "Team Members": project.teammates?.join(", ") || "",
        Tracks:
          project.project_tracks
            ?.map((t) => t.event_tracks?.name)
            .filter(Boolean)
            .join(", ") || "",
        "Feedback Text": fb.feedback_text,
        "Mentor Name": fb.mentor_name,
        "Mentor Email": fb.mentor_email,
      }));
    });

    const csv = Papa.unparse(feedbackRows);

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `feedback-${eventId}.csv`;
    a.click();
  };

  useEffect(() => {
    async function fetchProjects() {
      try {
        const { data, error } = await supabase
          .from("projects")
          .select(
            `
            id,
            project_name,
            lead_name,
            lead_email,
            project_description,
            project_url,
            teammates,
            submitted,
            created_at,
            project_tracks (
              event_tracks (
                track_id,
                name
              )
            ),
            feedback (
              feedback_text,
              mentor_name,
              mentor_email
            )
          `
          )
          .eq("event_id", eventId)
          .overrideTypes<ProjectData[]>();

        if (error) throw error;
        setProjects((data as ProjectData[]) || []);
      } catch (error) {
        console.error("Error fetching projects:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchProjects();
    // Subscribe to real-time updates
    const subscription = supabase
      .channel("projects_channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "projects",
          filter: `event_id=eq.${eventId}`,
        },
        async (payload) => {
          // Fetch the updated project with all related data
          if (payload.eventType === "DELETE") {
            setProjects((current) =>
              current.filter((p) => p.id !== payload.old.id)
            );
          } else {
            const { data, error } = await supabase
              .from("projects")
              .select(
                `
                id,
                project_name,
                lead_name,
                lead_email,
                project_description,
                project_url,
                teammates,
                submitted,
                created_at,
                project_tracks (
                  event_tracks (
                    track_id,
                    name
                  )
                ),
                feedback (
                  feedback_text,
                  mentor_name,
                  mentor_email
                )
              `
              )
              .eq("id", payload.new.id)
              .single()
              .overrideTypes<ProjectData>();

            if (!error && data) {
              setProjects((current) => {
                const newProjects = current.filter((p) => p.id !== data.id);
                return [...newProjects, data as ProjectData];
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [eventId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Submissions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Project Submissions</h3>
            <div className="flex gap-2">
              <Button disabled={loading} onClick={exportSubmissions}>Export Submissions</Button>
              <Button disabled={loading} onClick={exportFeedback} variant="outline">
                Export Feedback
              </Button>
            </div>
          </div>

          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-blue-900" />
          ) : (
            <div className="-mx-4 md:mx-0">
              <div className="overflow-x-auto">
                <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project Name</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Team Size</TableHead>
                  <TableHead>Tracks</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>{project.project_name}</TableCell>
                    <TableCell>{project.lead_name}</TableCell>
                    <TableCell>
                      {(project.teammates?.length || 0) + 1}
                    </TableCell>
                    <TableCell>
                      {project.project_tracks
                        ?.map((pt) => pt.event_tracks?.name)
                        .filter(Boolean)
                        .join(", ") || "No tracks"}
                    </TableCell>
                    <TableCell>{project.submitted ? "Yes" : "No"}</TableCell>
                    <TableCell>
                      {new Date(project.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Link href={`/projects/public/${project.id}`} passHref>
                        <Button variant="outline" size="sm" className="text-xs">
                          View Details
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
