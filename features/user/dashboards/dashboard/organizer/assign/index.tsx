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
import { Trash2, Plus, Shuffle } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { EventRole } from "@/lib/types";
import { supabase } from "@/lib/supabase";
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
  const { toast } = useToast();

  const fetchUsers = useCallback(async () => {
    // Using supabase directly since there's no API endpoint for users by role
    const { data: userRoles, error } = await supabase
      .from("user_event_roles")
      .select(
        `
        user_id,
        role,
        user_profiles:user_id (
          display_name,
          email
        )
      `
      )
      .eq("event_id", eventId)
      .in("role", [EventRole.Judge, EventRole.Mentor, EventRole.Organizer]);

    if (error) throw error;

    const users: User[] = (userRoles || []).map((ur) => {
      const profile = Array.isArray(ur.user_profiles)
        ? ur.user_profiles[0]
        : ur.user_profiles;
      return {
        user_id: ur.user_id,
        display_name: profile?.display_name || profile?.email?.split("@")[0] || "Unknown User",
        email: profile?.email || "",
        role: ur.role as EventRole,
      };
    });
    
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
    setProjects(data.projects || []);
  }, [eventId]);

  const fetchAssignments = useCallback(async () => {
    // First get all project assignments for projects in this event
    const { data: projectsInEvent } = await supabase
      .from("projects")
      .select("id")
      .eq("event_id", eventId);

    if (!projectsInEvent || projectsInEvent.length === 0) {
      setAssignments([]);
      return;
    }

    const projectIds = projectsInEvent.map((p) => p.id);

    const { data: assignmentData, error } = await supabase
      .from("project_assignments")
      .select(
        `
        id,
        project_id,
        user_id,
        role,
        projects:project_id (
          id,
          project_name,
          lead_name
        ),
        user_profiles:user_id (
          display_name,
          email
        )
      `
      )
      .in("project_id", projectIds);

    if (error) throw error;

    const assignments: Assignment[] = (assignmentData || []).map((a) => {
      const project = Array.isArray(a.projects) ? a.projects[0] : a.projects;
      const profile = Array.isArray(a.user_profiles)
        ? a.user_profiles[0]
        : a.user_profiles;
      return {
        id: a.id,
        project_id: a.project_id,
        user_id: a.user_id,
        role: a.role as EventRole,
        project: {
          id: project?.id || a.project_id,
          project_name: project?.project_name || "Unknown Project",
          lead_name: project?.lead_name || "Unknown Lead",
        },
        user: {
          user_id: a.user_id,
          display_name: profile?.display_name || profile?.email?.split("@")[0] || "Unknown User",
          email: profile?.email || "",
          role: a.role as EventRole,
        },
      };
    });

    setAssignments(assignments);
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
          <div className="flex items-center space-x-2 pb-2 border-b">
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
                  <TableHead>Project</TableHead>
                  <TableHead>Project Lead</TableHead>
                  <TableHead>Assigned Judges</TableHead>
                  <TableHead>Assigned Mentors</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => {
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
                      <TableCell className="font-medium">
                        {project.project_name}
                      </TableCell>
                      <TableCell>{project.lead_name}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {projectJudges.map((assignment) => (
                            <div
                              key={assignment.id}
                              className="flex items-center gap-2"
                            >
                              <Badge variant="outline">
                                {showName ? assignment.user.display_name : assignment.user.email}
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
                            showName={showName}
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
                              <Badge variant="outline">
                                {showName ? assignment.user.display_name : assignment.user.email}
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
                            showName={showName}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {projectJudges.length + projectMentors.length} total
                          assigned
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
  showName: boolean;
}

function ManualAssignSelect({
  projectId,
  role,
  users,
  existingAssignments,
  onAssign,
  showName,
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
              {showName ? user.display_name : user.email}
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
