"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import ProjectBoard from "@/features/projects/components/displays/ProjectBoard/ProjectBoard";
import { Project, ProjectBoardContext } from "@/lib/types";
import { DiscordCTA } from "@/components/ui/discord-cta";
import { Footer } from "@/components/layout/Footer";
import { useAuth } from "@/features/user/authentication/auth/AuthContext";
import { PageContainer, PageContent } from "@/components/layout/PageContainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Delete } from "@mui/icons-material";
import { toast } from "@/lib/hooks/use-toast";
import { useRouter } from "next/navigation";

export default function ProjectsPage() {
  const { session, isAuthenticated } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    const getSession = async () => {
      if (session?.user?.email) {
        await fetchProjects();
      }
      setIsLoading(false);
    };

    getSession();
  }, [session]);

  const fetchProjects = async () => {
    try {
      const response = await fetch("/api/projects/user");
      if (!response.ok) {
        throw new Error("Failed to fetch projects");
      }
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error("Error fetching projects:", error);
      setProjects([]);
    }
  };

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

      setProjects((prev) => prev.filter((p) => p.id !== projectId));
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

  const handleDraftClick = (project: Project) => {
    router.push(
      `/projects/${project.id}/edit`
    );
  };

  const submittedProjects = projects.filter((p) => p.submitted);
  const draftProjects = projects.filter((p) => !p.submitted);

  return (
    <PageContainer showBorder={isAuthenticated}>
      <Toaster />
      <PageContent className="pt-[24px] pb-8">
        <div className="flex flex-col gap-[24px] px-[32px]">
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-[8px]">
              <h1 className="text-[20px] sm:text-[28px] font-semibold leading-[1.4] tracking-[-0.06em] text-black">
                Projects
              </h1>
              {projects.length > 0 && (
                <div className="bg-white border border-[rgba(0,0,0,0.15)] px-[8px] py-0 rounded-[50px] flex items-center">
                  <span className="text-sm text-black leading-[1.5]">
                    {projects.length}
                  </span>
                </div>
              )}
            </div>
            {isAuthenticated && (
              <Button asChild className="h-10">
                <Link href="/projects/submit">Create a project</Link>
              </Button>
            )}
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            </div>
          )}

          {!session && !isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-4">
                  Please log in to view your projects
                </h2>
                <Link href="/login">
                  <Button className="bg-blue-900 text-white hover:bg-blue-800">
                    Login
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {session && !isLoading && (
            <>
              {/* Draft Projects Section */}
              {isAuthenticated && draftProjects.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Draft Projects</CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-y-auto max-h-[300px]">
                    <ul className="space-y-4">
                      {draftProjects.map((project) => (
                        <li key={project.id} className="border-b pb-2">
                          <div className="flex justify-between items-start gap-4">
                            <button
                              onClick={() => handleDraftClick(project)}
                              className="hover:text-blue-500 flex-grow text-left"
                            >
                              <h3 className="font-semibold">
                                {project.project_name || "Untitled Project"}
                              </h3>
                              <p className="text-sm text-gray-600">
                                {project.project_description || "No description"}
                              </p>
                            </button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="shrink-0"
                              onClick={() => handleDeleteProject(project.id)}
                              disabled={isDeleting === project.id}
                            >
                              <Delete className="h-4 w-4" />
                              <span className="sr-only">Delete project</span>
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Submitted Projects Section */}
              <div className="space-y-4">
                <h2 className="text-[20px] font-semibold leading-[1.4] tracking-[-0.06em] text-black">
                  Submitted Projects
                </h2>
                <ProjectBoard
                  isLoading={false}
                  projectList={submittedProjects}
                  session={session}
                  projectBoardContext={ProjectBoardContext.MyProjects}
                />
              </div>

              {/* Discord CTA on projects page (only for unauthenticated users) */}
              {!isAuthenticated && (
                <div className="mt-12">
                  <DiscordCTA variant="default" />
                </div>
              )}
            </>
          )}
        </div>
      </PageContent>
      {!isAuthenticated && <Footer />}
    </PageContainer>
  );
}
