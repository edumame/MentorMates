import { useState } from "react";
import { Project } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "@/lib/hooks/use-toast";

interface ProjectsTabProps {
  eventId: string;
  myProjects: Project[];
  setMyProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  isLoading: boolean;
}

export function ProjectsTab({
  eventId,
  myProjects,
  setMyProjects,
  isLoading,
}: ProjectsTabProps) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDeleteProject = async (projectId: string) => {
    try {
      setIsDeleting(projectId);
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete project");
      }

      setMyProjects((prev) => prev.filter((p) => p.id !== projectId));
      toast({
        title: "Project deleted successfully",
        description: "The project has been deleted.",
      });
    } catch (error) {
      console.error("Error deleting project:", error);
      toast({
        title: "Failed to delete project",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Projects</h2>
        <Link href={`/events/${eventId}/submit`}>
          <Button className="button-gradient text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create Project
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Submitted Projects</CardTitle>
            </CardHeader>
            <CardContent className="overflow-y-auto max-h-[250px]">
              {isLoading ? (
                <p>Loading...</p>
              ) : myProjects.filter((p) => p.submitted).length === 0 ? (
                <p>No submitted projects yet.</p>
              ) : (
                <ul className="space-y-4">
                  {myProjects
                    .filter((project) => project.submitted)
                    .map((project) => (
                      <li key={project.id} className="border-b pb-2">
                        <Link
                          href={`/projects/${project.id}`}
                          className="hover:text-blue-500"
                        >
                          <h3 className="font-semibold">
                            {project.project_name}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {project.project_description}
                          </p>
                        </Link>
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Unsubmitted Projects</CardTitle>
            </CardHeader>
            <CardContent className="overflow-y-auto max-h-[250px]">
              {isLoading ? (
                <p>Loading...</p>
              ) : myProjects.filter((p) => !p.submitted).length === 0 ? (
                <p>No unsubmitted projects.</p>
              ) : (
                <ul className="space-y-4">
                  {myProjects
                    .filter((project) => !project.submitted)
                    .map((project) => (
                      <li key={project.id} className="border-b pb-2">
                        <div className="flex justify-between items-start gap-4">
                          <Link
                            href={`/events/${eventId}/submit/draft/${project.id}`}
                            className="hover:text-blue-500 flex-grow"
                          >
                            <h3 className="font-semibold">
                              {project.project_name}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {project.project_description}
                            </p>
                          </Link>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="shrink-0"
                            onClick={() => handleDeleteProject(project.id)}
                            disabled={isDeleting === project.id}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete project</span>
                          </Button>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Event Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">Total Projects</h3>
                <p className="text-2xl">{myProjects.length}</p>
              </div>
              <div>
                <h3 className="font-semibold">Submitted Projects</h3>
                <p className="text-2xl">
                  {myProjects.filter((p) => p.submitted).length}
                </p>
              </div>
              <div>
                <h3 className="font-semibold">Unsubmitted Projects</h3>
                <p className="text-2xl">
                  {myProjects.filter((p) => !p.submitted).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
