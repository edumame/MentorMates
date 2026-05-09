"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import Link from "next/link";
import {
  Loader2,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Settings2,
  Columns3,
} from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { SubmissionFieldsSettings } from "./SubmissionFieldsSettings";
import {
  buildCustomFieldColumns,
  buildSubmissionExportRows,
  formatSubmissionValue,
} from "./export";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EventTrack } from "@/lib/types";
import {
  fetchEventTracks,
  updateProjectTracks,
} from "@/features/projects/client-actions/client-track-update";

interface ProjectData {
  id: string;
  project_name: string;
  lead_name: string;
  lead_email: string;
  lead_school?: string | null;
  project_description: string;
  teammates: string[];
  teammate_profiles?: {
    email: string;
    display_name?: string | null;
    affiliation?: string | null;
  }[];
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
  artifacts?: {
    kind: "project_link" | "video_link" | "additional_material";
    label?: string;
    url: string;
    is_primary?: boolean;
  }[];
  submission_fields?: {
    key: string;
    label: string;
  }[];
  submission_values?: Record<string, string | string[]>;
}

interface SubmissionsTabProps {
  eventId: string;
}

type SortField = "project_name" | "lead_name" | "team_size" | "submitted" | "created_at";
type SortDirection = "asc" | "desc";

export function SubmissionsTab({ eventId }: SubmissionsTabProps) {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [eventTracks, setEventTracks] = useState<EventTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [sortField, setSortField] = useState<SortField>("project_name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [trackDialogProjectId, setTrackDialogProjectId] = useState<string | null>(null);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [isSavingTracks, setIsSavingTracks] = useState(false);
  const [visibleSubmissionFieldKeys, setVisibleSubmissionFieldKeys] = useState<
    string[]
  >([]);
  const { toast } = useToast();

  const trackDialogProject = projects.find((project) => project.id === trackDialogProjectId);
  const submissionFieldColumns = useMemo(
    () => buildCustomFieldColumns(projects),
    [projects]
  );
  const visibleSubmissionFieldKeySet = useMemo(
    () => new Set(visibleSubmissionFieldKeys),
    [visibleSubmissionFieldKeys]
  );
  const visibleSubmissionFieldColumns = submissionFieldColumns.filter((field) =>
    visibleSubmissionFieldKeySet.has(field.key)
  );

  const getProjectTrackIds = (project: ProjectData) =>
    project.project_tracks
      ?.map((projectTrack) => projectTrack.event_tracks?.track_id)
      .filter((trackId): trackId is string => Boolean(trackId)) || [];

  const openTrackDialog = (project: ProjectData) => {
    setTrackDialogProjectId(project.id);
    setSelectedTrackIds(getProjectTrackIds(project));
  };

  const handleTrackToggle = (trackId: string, checked: boolean) => {
    setSelectedTrackIds((current) => {
      if (checked) {
        return current.includes(trackId) ? current : [...current, trackId];
      }

      return current.filter((id) => id !== trackId);
    });
  };

  const handleTrackDialogOpenChange = (open: boolean) => {
    if (open) {
      return;
    }

    setTrackDialogProjectId(null);
    setSelectedTrackIds([]);
  };

  const handleSaveProjectTracks = async () => {
    if (!trackDialogProject) {
      return;
    }

    try {
      setIsSavingTracks(true);

      const { success, error } = await updateProjectTracks(
        trackDialogProject.id,
        selectedTrackIds
      );

      if (!success || error) {
        throw error || new Error("Failed to update project tracks");
      }

      const selectedTrackSet = new Set(selectedTrackIds);
      const updatedProjectTracks = eventTracks
        .filter((track) => selectedTrackSet.has(track.track_id))
        .map((track) => ({
          event_tracks: {
            track_id: track.track_id,
            name: track.name,
          },
        }));

      setProjects((current) =>
        current.map((project) =>
          project.id === trackDialogProject.id
            ? {
                ...project,
                project_tracks: updatedProjectTracks,
              }
            : project
        )
      );

      toast({
        title: "Project tracks updated",
        description: `Saved track assignments for "${trackDialogProject.project_name}".`,
      });
      handleTrackDialogOpenChange(false);
    } catch (error) {
      console.error("Error updating project tracks:", error);
      toast({
        title: "Error",
        description: "Failed to update project tracks",
        variant: "destructive",
      });
    } finally {
      setIsSavingTracks(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-4 w-4 ml-1" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1" />
    );
  };

  const sortedProjects = [...projects].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case "project_name":
        comparison = (a.project_name || "").localeCompare(b.project_name || "");
        break;
      case "lead_name":
        comparison = (a.lead_name || "").localeCompare(b.lead_name || "");
        break;
      case "team_size":
        comparison = ((a.teammates?.length || 0) + 1) - ((b.teammates?.length || 0) + 1);
        break;
      case "submitted":
        comparison = (a.submitted ? 1 : 0) - (b.submitted ? 1 : 0);
        break;
      case "created_at":
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
    }
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const handleSelectProject = (projectId: string, checked: boolean) => {
    setSelectedProjects((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(projectId);
      } else {
        newSet.delete(projectId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProjects(new Set(projects.map((p) => p.id)));
    } else {
      setSelectedProjects(new Set());
    }
  };

  const handleSubmissionFieldColumnToggle = (
    fieldKey: string,
    checked: boolean
  ) => {
    setVisibleSubmissionFieldKeys((current) => {
      if (checked) {
        return current.includes(fieldKey) ? current : [...current, fieldKey];
      }

      return current.filter((key) => key !== fieldKey);
    });
  };

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    setDeletingProjectId(projectId);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete project");
      }

      toast({
        title: "Project deleted",
        description: `"${projectName}" has been deleted successfully.`,
      });

      // The real-time subscription will handle updating the list
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete project",
        variant: "destructive",
      });
    } finally {
      setDeletingProjectId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProjects.size === 0) return;

    setIsBulkDeleting(true);
    const projectIds = Array.from(selectedProjects);
    let successCount = 0;
    let errorCount = 0;

    for (const projectId of projectIds) {
      try {
        const response = await fetch(`/api/projects/${projectId}`, {
          method: "DELETE",
        });

        if (response.ok) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch {
        errorCount++;
      }
    }

    if (successCount > 0) {
      toast({
        title: "Projects deleted",
        description: `Successfully deleted ${successCount} project${successCount > 1 ? "s" : ""}.${errorCount > 0 ? ` Failed to delete ${errorCount}.` : ""}`,
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to delete selected projects.",
        variant: "destructive",
      });
    }

    setSelectedProjects(new Set());
    setIsBulkDeleting(false);
  };

  const exportSubmissions = async () => {
    if (projects.length > 0) {
      const csv = Papa.unparse(buildSubmissionExportRows(projects));

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
        const [projectsResponse, tracksResponse] = await Promise.all([
          fetch(`/api/projects?eventId=${eventId}`),
          fetchEventTracks(eventId),
        ]);

        const payload = (await projectsResponse.json().catch(() => ({}))) as {
          projects?: ProjectData[];
          error?: string;
        };

        if (!projectsResponse.ok) {
          throw new Error(payload.error || "Failed to fetch projects");
        }

        if (tracksResponse.error) {
          throw tracksResponse.error;
        }

        setProjects(payload.projects || []);
        setEventTracks(tracksResponse.data || []);
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
            const response = await fetch(
              `/api/projects?projectId=${payload.new.id}`
            );
            const json = (await response.json().catch(() => ({}))) as {
              project?: ProjectData;
            };

            if (response.ok && json.project) {
              setProjects((current) => {
                const newProjects = current.filter(
                  (project) => project.id !== json.project?.id
                );
                return [...newProjects, json.project as ProjectData];
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

  useEffect(() => {
    const availableFieldKeys = new Set(
      submissionFieldColumns.map((field) => field.key)
    );

    setVisibleSubmissionFieldKeys((current) =>
      current.filter((key) => availableFieldKeys.has(key))
    );
  }, [submissionFieldColumns]);

  return (
    <div className="space-y-6">
      <SubmissionFieldsSettings eventId={eventId} />
      <Card>
        <CardHeader>
          <CardTitle>Project Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Project Submissions</h3>
              <div className="flex gap-2">
                {selectedProjects.size > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="delete"
                        disabled={isBulkDeleting}
                      >
                        {isBulkDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-2" />
                        )}
                        Delete Selected ({selectedProjects.size})
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {selectedProjects.size} Projects</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete {selectedProjects.size} selected project{selectedProjects.size > 1 ? "s" : ""}?
                          This action cannot be undone. All project data, tracks, and
                          associated feedback will be permanently removed.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleBulkDelete}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete {selectedProjects.size} Projects
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <Button disabled={loading} onClick={exportSubmissions} className="rounded-[12px]">Export Submissions</Button>
                <Button disabled={loading} onClick={exportFeedback} variant="outline" className="rounded-[12px]">
                  Export Feedback
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      disabled={loading || submissionFieldColumns.length === 0}
                      variant="outline"
                      className="rounded-[12px]"
                    >
                      <Columns3 className="mr-2 h-4 w-4" />
                      Columns
                      {visibleSubmissionFieldColumns.length > 0
                        ? ` (${visibleSubmissionFieldColumns.length})`
                        : ""}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="max-h-80 w-72 overflow-y-auto"
                  >
                    <DropdownMenuLabel>Project submission questions</DropdownMenuLabel>
                    {submissionFieldColumns.map((field) => (
                      <DropdownMenuCheckboxItem
                        key={field.key}
                        checked={visibleSubmissionFieldKeySet.has(field.key)}
                        onCheckedChange={(checked) =>
                          handleSubmissionFieldColumnToggle(
                            field.key,
                            checked === true
                          )
                        }
                      >
                        <span className="truncate">{field.columnLabel}</span>
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-blue-900" />
            ) : (
              <div className="overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={projects.length > 0 && selectedProjects.size === projects.length}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all projects"
                    />
                  </TableHead>
                  <TableHead>
                    <button
                      className="flex items-center hover:text-foreground"
                      onClick={() => handleSort("project_name")}
                    >
                      Project Name
                      {getSortIcon("project_name")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      className="flex items-center hover:text-foreground"
                      onClick={() => handleSort("lead_name")}
                    >
                      Lead
                      {getSortIcon("lead_name")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      className="flex items-center hover:text-foreground"
                      onClick={() => handleSort("team_size")}
                    >
                      Team Size
                      {getSortIcon("team_size")}
                    </button>
                  </TableHead>
                  <TableHead>Tracks</TableHead>
                  <TableHead>
                    <button
                      className="flex items-center hover:text-foreground"
                      onClick={() => handleSort("submitted")}
                    >
                      Submitted
                      {getSortIcon("submitted")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      className="flex items-center hover:text-foreground"
                      onClick={() => handleSort("created_at")}
                    >
                      Created At
                      {getSortIcon("created_at")}
                    </button>
                  </TableHead>
                  {visibleSubmissionFieldColumns.map((field) => (
                    <TableHead key={field.key} className="min-w-48">
                      {field.columnLabel}
                    </TableHead>
                  ))}
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProjects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedProjects.has(project.id)}
                        onCheckedChange={(checked) =>
                          handleSelectProject(project.id, checked as boolean)
                        }
                        aria-label={`Select ${project.project_name}`}
                      />
                    </TableCell>
                    <TableCell>{project.project_name}</TableCell>
                    <TableCell>{project.lead_name}</TableCell>
                    <TableCell>
                      {(project.teammates?.length || 0) + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {project.project_tracks?.length ? (
                          project.project_tracks.map((projectTrack) => {
                            const trackId = projectTrack.event_tracks?.track_id;
                            const trackName = projectTrack.event_tracks?.name;

                            if (!trackId || !trackName) {
                              return null;
                            }

                            return (
                              <Badge key={trackId} variant="outline">
                                {trackName}
                              </Badge>
                            );
                          })
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            No tracks
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{project.submitted ? "Yes" : "No"}</TableCell>
                    <TableCell>
                      {new Date(project.created_at).toLocaleDateString()}
                    </TableCell>
                    {visibleSubmissionFieldColumns.map((field) => (
                      <TableCell key={field.key} className="max-w-64">
                        <div className="whitespace-pre-wrap break-words">
                          {formatSubmissionValue(
                            project.submission_values?.[field.key]
                          ) || (
                            <span className="text-sm text-muted-foreground">
                              -
                            </span>
                          )}
                        </div>
                      </TableCell>
                    ))}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link href={`/projects/public/${project.id}`}>
                          <Button variant="outline" size="sm" className="text-xs">
                            View Details
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => openTrackDialog(project)}
                        >
                          <Settings2 className="mr-1 h-3.5 w-3.5" />
                          Manage Tracks
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              disabled={deletingProjectId === project.id}
                            >
                              {deletingProjectId === project.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Project</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete &quot;{project.project_name}&quot;?
                                This action cannot be undone. All project data, tracks, and
                                associated feedback will be permanently removed.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteProject(project.id, project.project_name)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(trackDialogProject)}
        onOpenChange={handleTrackDialogOpenChange}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Project Tracks</DialogTitle>
            <DialogDescription>
              {trackDialogProject
                ? `Choose which tracks "${trackDialogProject.project_name}" should be assigned to.`
                : "Choose which tracks this project should be assigned to."}
            </DialogDescription>
          </DialogHeader>

          {eventTracks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No event tracks are available yet. Create tracks first in the Tracks
              tab.
            </p>
          ) : (
            <div className="grid gap-3">
              {eventTracks.map((track) => {
                const checked = selectedTrackIds.includes(track.track_id);

                return (
                  <label
                    key={track.track_id}
                    className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) =>
                        handleTrackToggle(track.track_id, value === true)
                      }
                      aria-label={`Assign ${track.name}`}
                      disabled={isSavingTracks}
                    />
                    <div className="space-y-1">
                      <div className="text-sm font-medium">{track.name}</div>
                      {track.description ? (
                        <p className="text-sm text-muted-foreground">
                          {track.description}
                        </p>
                      ) : null}
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleTrackDialogOpenChange(false)}
              disabled={isSavingTracks}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveProjectTracks}
              disabled={isSavingTracks || !trackDialogProject}
            >
              {isSavingTracks ? "Saving..." : "Save Tracks"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
