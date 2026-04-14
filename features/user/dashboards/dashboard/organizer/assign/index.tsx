"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Trash2,
  Plus,
  Shuffle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
} from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { EventRole } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { buildJudgeProjectPairs } from "./batch-assignments";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

interface Project {
  id: string;
  project_name: string;
  lead_name: string;
  tracks?: ProjectTrack[];
}

interface ProjectTrack {
  track_id: string;
  name?: string | null;
  label?: string | null;
}

interface User {
  user_id: string;
  display_name: string;
  email: string;
  role: EventRole;
}

interface Assignment {
  id: string;
  project_id: string;
  user_id: string;
  role: EventRole;
  project: Project;
  user: User;
}

interface AssignTabProps {
  eventId: string;
}

type SortField = "project_name" | "lead_name" | "judges" | "mentors" | "total";
type SortDirection = "asc" | "desc";

export function AssignTab({ eventId }: AssignTabProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [judges, setJudges] = useState<User[]>([]);
  const [mentors, setMentors] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [judgesPerProject, setJudgesPerProject] = useState<number>(3);
  const [mentorsPerProject, setMentorsPerProject] = useState<number>(1);
  const [includeOrganizers, setIncludeOrganizers] = useState<boolean>(false);
  const [showName, setShowName] = useState<boolean>(false);
  const [sortField, setSortField] = useState<SortField>("project_name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedJudgeIds, setSelectedJudgeIds] = useState<Set<string>>(
    new Set()
  );
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(
    new Set()
  );
  const [batchAssigning, setBatchAssigning] = useState<boolean>(false);
  const { toast } = useToast();

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

  const getProjectAssignmentCounts = (projectId: string) => {
    const judgeCount = assignments.filter(
      (a) => a.project_id === projectId && a.role === EventRole.Judge
    ).length;
    const mentorCount = assignments.filter(
      (a) => a.project_id === projectId && a.role === EventRole.Mentor
    ).length;
    return { judgeCount, mentorCount, total: judgeCount + mentorCount };
  };

  const sortedProjects = [...projects].sort((a, b) => {
    const countsA = getProjectAssignmentCounts(a.id);
    const countsB = getProjectAssignmentCounts(b.id);

    let comparison = 0;
    switch (sortField) {
      case "project_name":
        comparison = a.project_name.localeCompare(b.project_name);
        break;
      case "lead_name":
        comparison = a.lead_name.localeCompare(b.lead_name);
        break;
      case "judges":
        comparison = countsA.judgeCount - countsB.judgeCount;
        break;
      case "mentors":
        comparison = countsA.mentorCount - countsB.mentorCount;
        break;
      case "total":
        comparison = countsA.total - countsB.total;
        break;
    }
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const fetchUsers = useCallback(async () => {
    const response = await fetch(
      `/api/events/${eventId}/users?roles=${EventRole.Judge},${EventRole.Mentor},${EventRole.Organizer}&limit=500`
    );
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Failed to fetch users");
    }

    const users: User[] = (payload.users || []).map(
      (user: {
        user_id: string;
        role: EventRole;
        display_name: string;
        email: string;
      }) => ({
        user_id: user.user_id,
        display_name:
          user.display_name || user.email?.split("@")[0] || "Unknown User",
        email: user.email || "",
        role: user.role,
      })
    );
    
    if (includeOrganizers) {
      // Include organizers in both judges and mentors pools
      setJudges(users.filter((u) => u.role === EventRole.Judge || u.role === EventRole.Organizer));
      setMentors(users.filter((u) => u.role === EventRole.Mentor || u.role === EventRole.Organizer));
    } else {
      // Exclude organizers
      setJudges(users.filter((u) => u.role === EventRole.Judge));
      setMentors(users.filter((u) => u.role === EventRole.Mentor));
    }
  }, [eventId, includeOrganizers]);

  const fetchProjects = useCallback(async () => {
    const response = await fetch(`/api/projects?eventId=${eventId}&submitted=true`);
    if (!response.ok) throw new Error("Failed to fetch projects");
    const data = await response.json();
    
    // Transform the projects to extract tracks from project_tracks
    const transformedProjects = (data.projects || []).map((project: {
      id: string;
      project_name: string;
      lead_name: string;
      project_tracks?: Array<{
        track_id: string;
        event_tracks?: {
          track_id: string;
          name: string | null;
          label: string | null;
        };
      }>;
      [key: string]: unknown;
    }) => ({
      ...project,
      tracks: project.project_tracks
        ?.map((pt): ProjectTrack | null => pt.event_tracks ? {
          track_id: pt.event_tracks.track_id,
          name: pt.event_tracks.name,
          label: pt.event_tracks.label,
        } : null)
        .filter((track): track is ProjectTrack => track !== null) || [],
    }));
    
    setProjects(transformedProjects);
  }, [eventId]);

  const fetchAssignments = useCallback(async () => {
    const response = await fetch(`/api/events/${eventId}/project-assignments`);
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Failed to fetch assignments");
    }

    setAssignments(payload.assignments || []);
  }, [eventId]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchProjects(), fetchUsers(), fetchAssignments()]);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load assignment data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [fetchProjects, fetchUsers, fetchAssignments, toast]);

  // Fetch all data
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refetch users when includeOrganizers changes
  useEffect(() => {
    if (!loading) {
      fetchUsers();
    }
  }, [includeOrganizers, loading, fetchUsers]);

  useEffect(() => {
    setSelectedProjectIds((previousSelection) => {
      const currentProjectIds = new Set(projects.map((project) => project.id));
      const validSelection = new Set(
        [...previousSelection].filter((projectId) =>
          currentProjectIds.has(projectId)
        )
      );
      return validSelection.size === previousSelection.size
        ? previousSelection
        : validSelection;
    });
  }, [projects]);

  useEffect(() => {
    setSelectedJudgeIds((previousSelection) => {
      const currentJudgeIds = new Set(judges.map((judge) => judge.user_id));
      const validSelection = new Set(
        [...previousSelection].filter((judgeId) => currentJudgeIds.has(judgeId))
      );
      return validSelection.size === previousSelection.size
        ? previousSelection
        : validSelection;
    });
  }, [judges]);

  const handleAutoAssign = async (role: EventRole) => {
    setAutoAssigning(true);
    try {
      const rolesPerProject =
        role === EventRole.Judge ? judgesPerProject : mentorsPerProject;
      const response = await fetch("/api/roles/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          role,
          rolesPerProject,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.error || "Error auto-assigning roles");
      }

      toast({
        title: "Success",
        description: `Auto-assigned ${role}s to projects`,
      });

      await fetchAssignments();
    } catch (error) {
      console.error("Error auto-assigning:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to auto-assign roles",
        variant: "destructive",
      });
    } finally {
      setAutoAssigning(false);
    }
  };

  const handleIndividualAssign = async (
    userId: string,
    projectId: string,
    role: EventRole
  ) => {
    try {
      const response = await fetch(`/api/roles/assign/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          role,
          eventId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.error || "Error assigning role");
      }

      toast({
        title: "Success",
        description: "Assignment updated successfully",
      });

      await fetchAssignments();
    } catch (error) {
      console.error("Error assigning role:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to assign role",
        variant: "destructive",
      });
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from("project_assignments")
        .delete()
        .eq("id", assignmentId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Assignment removed successfully",
      });

      await fetchAssignments();
    } catch (error) {
      console.error("Error removing assignment:", error);
      toast({
        title: "Error",
        description: "Failed to remove assignment",
        variant: "destructive",
      });
    }
  };

  const getProjectAssignments = (projectId: string, role: EventRole) => {
    return assignments.filter(
      (a) => a.project_id === projectId && a.role === role
    );
  };

  const toggleJudgeSelection = (judgeId: string, checked: boolean) => {
    setSelectedJudgeIds((previousSelection) => {
      const updatedSelection = new Set(previousSelection);
      if (checked) {
        updatedSelection.add(judgeId);
      } else {
        updatedSelection.delete(judgeId);
      }
      return updatedSelection;
    });
  };

  const toggleProjectSelection = (projectId: string, checked: boolean) => {
    setSelectedProjectIds((previousSelection) => {
      const updatedSelection = new Set(previousSelection);
      if (checked) {
        updatedSelection.add(projectId);
      } else {
        updatedSelection.delete(projectId);
      }
      return updatedSelection;
    });
  };

  const handleSelectAllProjects = (checked: boolean) => {
    if (!checked) {
      setSelectedProjectIds(new Set());
      return;
    }
    setSelectedProjectIds(new Set(sortedProjects.map((project) => project.id)));
  };

  const handleClearBatchSelection = () => {
    setSelectedJudgeIds(new Set());
    setSelectedProjectIds(new Set());
  };

  const handleBatchAssignJudges = async () => {
    const candidatePairs = buildJudgeProjectPairs(
      selectedJudgeIds,
      selectedProjectIds
    );
    if (candidatePairs.length === 0) {
      toast({
        title: "No selections",
        description: "Select at least one judge and one project.",
        variant: "destructive",
      });
      return;
    }

    const existingJudgeAssignmentKeys = new Set(
      assignments
        .filter((assignment) => assignment.role === EventRole.Judge)
        .map((assignment) => `${assignment.project_id}:${assignment.user_id}`)
    );

    const newPairs = candidatePairs.filter(
      ({ projectId, judgeId }) =>
        !existingJudgeAssignmentKeys.has(`${projectId}:${judgeId}`)
    );

    if (newPairs.length === 0) {
      toast({
        title: "No changes",
        description:
          "All selected judges are already assigned to the selected projects.",
      });
      return;
    }

    setBatchAssigning(true);
    try {
      const results = await Promise.allSettled(
        newPairs.map(async ({ judgeId, projectId }) => {
          const response = await fetch(`/api/roles/assign/${judgeId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId,
              role: EventRole.Judge,
              eventId,
            }),
          });

          if (!response.ok) {
            let errorMessage = "Error assigning role";
            try {
              const errorData = await response.json();
              errorMessage = errorData?.error || errorMessage;
            } catch {
              // Best effort parse for failed assignment errors.
            }
            throw new Error(errorMessage);
          }
        })
      );

      const failedCount = results.filter(
        (result) => result.status === "rejected"
      ).length;
      const successCount = newPairs.length - failedCount;

      if (failedCount > 0) {
        toast({
          title: "Partial success",
          description: `${successCount} assignments added, ${failedCount} failed.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: `Assigned ${selectedJudgeIds.size} judge${selectedJudgeIds.size === 1 ? "" : "s"} to ${selectedProjectIds.size} project${selectedProjectIds.size === 1 ? "" : "s"}.`,
        });
      }

      await fetchAssignments();
      if (failedCount === 0) {
        setSelectedProjectIds(new Set());
      }
    } catch (error) {
      console.error("Error batch assigning judges:", error);
      toast({
        title: "Error",
        description: "Failed to assign judges in bulk.",
        variant: "destructive",
      });
    } finally {
      setBatchAssigning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Judge & Mentor Assignments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Auto-Assignment Controls */}
        <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
          <h3 className="font-semibold">Auto-Assignment</h3>
          <p className="text-sm text-muted-foreground">
            Automatically assign judges and mentors to projects using a balanced
            distribution algorithm.
          </p>

          {/* Include Organizers Toggle */}
          <div className="flex items-center space-x-2 pb-2 border-b">
            <Switch
              id="include-organizers"
              checked={includeOrganizers}
              onCheckedChange={setIncludeOrganizers}
            />
            <Label htmlFor="include-organizers" className="cursor-pointer">
              Include organizers in assignment pools
            </Label>
          </div>

          {/* Show Name/Email Toggle */}
          <div className="flex items-center space-x-2 pb-2">
            <Switch
              id="show-name"
              checked={showName}
              onCheckedChange={setShowName}
            />
            <Label htmlFor="show-name" className="cursor-pointer">
              Show names (instead of emails)
            </Label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="judges-per-project">Judges per Project</Label>
                <Input
                  id="judges-per-project"
                  type="number"
                  min="0"
                  max="10"
                  value={judgesPerProject}
                  onChange={(e) =>
                    setJudgesPerProject(parseInt(e.target.value) || 1)
                  }
                />
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    disabled={autoAssigning || judges.length === 0}
                    className="w-full"
                  >
                    <Shuffle className="h-4 w-4 mr-2" />
                    Auto-Assign Judges ({judges.length} available)
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm judge reassignment</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will wipe all existing judge assignments for this event and reassign them.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleAutoAssign(EventRole.Judge)}>
                      Confirm
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="mentors-per-project">Mentors per Project</Label>
                <Input
                  id="mentors-per-project"
                  type="number"
                  min="0"
                  max="10"
                  value={mentorsPerProject}
                  onChange={(e) =>
                    setMentorsPerProject(parseInt(e.target.value) || 1)
                  }
                />
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    disabled={autoAssigning || mentors.length === 0}
                    className="w-full"
                  >
                    <Shuffle className="h-4 w-4 mr-2" />
                    Auto-Assign Mentors ({mentors.length} available)
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm mentor reassignment</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will wipe all existing mentor assignments for this event and reassign them.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleAutoAssign(EventRole.Mentor)}>
                      Confirm
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
        <div className="space-y-4 p-4 border rounded-lg">
          <h3 className="font-semibold">Batch Assign Judges</h3>
          <p className="text-sm text-muted-foreground">
            Pick one or more judges, then select projects in the table to assign
            them in one action.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Select judges</Label>
              <div className="max-h-48 overflow-y-auto rounded-md border p-3 space-y-2">
                {judges.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No judges available to assign.
                  </p>
                ) : (
                  judges.map((judge) => (
                    <div
                      key={judge.user_id}
                      className="flex items-center gap-2"
                    >
                      <Checkbox
                        id={`batch-judge-${judge.user_id}`}
                        checked={selectedJudgeIds.has(judge.user_id)}
                        onCheckedChange={(checked) =>
                          toggleJudgeSelection(judge.user_id, checked === true)
                        }
                      />
                      <Label
                        htmlFor={`batch-judge-${judge.user_id}`}
                        className="cursor-pointer text-sm font-normal flex flex-col"
                      >
                        <span className="font-medium text-foreground">
                          {judge.display_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {judge.email}
                        </span>
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-md border p-3 text-sm text-muted-foreground">
                Selected judges: {selectedJudgeIds.size}
                <br />
                Selected projects: {selectedProjectIds.size}
              </div>
              <Button
                className="w-full"
                disabled={
                  batchAssigning ||
                  selectedJudgeIds.size === 0 ||
                  selectedProjectIds.size === 0
                }
                onClick={handleBatchAssignJudges}
              >
                {batchAssigning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  "Assign selected judges to selected projects"
                )}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleClearBatchSelection}
                disabled={
                  selectedJudgeIds.size === 0 && selectedProjectIds.size === 0
                }
              >
                Clear batch selections
              </Button>
            </div>
          </div>
        </div>
        {/* Assignment Table */}
        <div className="space-y-4">
          <h3 className="font-semibold">Current Assignments for Submitted Projects</h3>

          {projects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No projects found for this event.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        sortedProjects.length > 0 &&
                        selectedProjectIds.size === sortedProjects.length
                      }
                      onCheckedChange={(checked) =>
                        handleSelectAllProjects(checked === true)
                      }
                      aria-label="Select all submitted projects for batch assignment"
                    />
                  </TableHead>
                  <TableHead>
                    <button
                      className="flex items-center hover:text-foreground"
                      onClick={() => handleSort("project_name")}
                    >
                      Project
                      {getSortIcon("project_name")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      className="flex items-center hover:text-foreground"
                      onClick={() => handleSort("lead_name")}
                    >
                      Project Lead
                      {getSortIcon("lead_name")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      className="flex items-center hover:text-foreground"
                      onClick={() => handleSort("judges")}
                    >
                      Assigned Judges
                      {getSortIcon("judges")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      className="flex items-center hover:text-foreground"
                      onClick={() => handleSort("mentors")}
                    >
                      Assigned Mentors
                      {getSortIcon("mentors")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      className="flex items-center hover:text-foreground"
                      onClick={() => handleSort("total")}
                    >
                      Total
                      {getSortIcon("total")}
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProjects.map((project) => {
                  const projectJudges = getProjectAssignments(
                    project.id,
                    EventRole.Judge
                  );
                  const projectMentors = getProjectAssignments(
                    project.id,
                    EventRole.Mentor
                  );

                  return (
                    <TableRow key={project.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedProjectIds.has(project.id)}
                          onCheckedChange={(checked) =>
                            toggleProjectSelection(project.id, checked === true)
                          } 
                          aria-label={`Select ${project.project_name} for batch assignment`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="space-y-1">
                          <div>{project.project_name}</div>
                          <div className="flex flex-wrap gap-1">
                            {(project.tracks || []).length > 0 ? (
                              project.tracks?.map((track) => (
                                <Badge key={track.track_id} variant="outline">
                                  {track.label || track.name || "Unnamed Track"}
                                </Badge>
                              ))
                            ) : (
                              <Badge variant="outline">No track</Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{project.lead_name}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {projectJudges.map((assignment) => (
                            <div
                              key={assignment.id}
                              className="flex items-center gap-2"
                            >
                              <Badge
                                variant="outline"
                                title={assignment.user.email}
                              >
                                {assignment.user.display_name}
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  handleRemoveAssignment(assignment.id)
                                }
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                          <ManualAssignSelect
                            projectId={project.id}
                            role={EventRole.Judge}
                            users={judges}
                            existingAssignments={projectJudges.map(
                              (a) => a.user_id
                            )}
                            onAssign={handleIndividualAssign}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {projectMentors.map((assignment) => (
                            <div
                              key={assignment.id}
                              className="flex items-center gap-2"
                            >
                              <Badge
                                variant="outline"
                                title={assignment.user.email}
                              >
                                {assignment.user.display_name}
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  handleRemoveAssignment(assignment.id)
                                }
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                          <ManualAssignSelect
                            projectId={project.id}
                            role={EventRole.Mentor}
                            users={mentors}
                            existingAssignments={projectMentors.map(
                              (a) => a.user_id
                            )}
                            onAssign={handleIndividualAssign}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {projectJudges.length + projectMentors.length}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Helper component for manual assignment
interface ManualAssignSelectProps {
  projectId: string;
  role: EventRole;
  users: User[];
  existingAssignments: string[];
  onAssign: (userId: string, projectId: string, role: EventRole) => void;
}

function ManualAssignSelect({
  projectId,
  role,
  users,
  existingAssignments,
  onAssign,
}: ManualAssignSelectProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const availableToAssign = users.filter(
    (user) => !existingAssignments.includes(user.user_id)
  );
  const handleAssign = () => {
    if (selectedUserId) {
      onAssign(selectedUserId, projectId, role);
      setSelectedUserId("");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedUserId} onValueChange={setSelectedUserId}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder={`Add ${role}`} />
        </SelectTrigger>
        <SelectContent>
          {availableToAssign.map((user) => (
            <SelectItem key={user.user_id} value={user.user_id}>
              <div className="flex flex-col">
                <span className="font-medium">{user.display_name}</span>
                <span className="text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" onClick={handleAssign} disabled={!selectedUserId}>
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}
