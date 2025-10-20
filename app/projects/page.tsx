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

export default function ProjectsPage() {
  const { session, isAuthenticated } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  if (isLoading) {
    return (
      <PageContainer showBorder={isAuthenticated}>
        <div className="flex items-center justify-center flex-grow">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
        </div>
      </PageContainer>
    );
  }

  if (!session) {
    return (
      <PageContainer showBorder={isAuthenticated}>
        <div className="flex items-center justify-center flex-grow">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">
              Please log in to view your projects
            </h1>
            <Link href="/login">
              <Button className="bg-blue-900 text-white hover:bg-blue-800">
                Login
              </Button>
            </Link>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer showBorder={isAuthenticated}>
      <Toaster />
      <PageContent className="px-[32px] pt-[32px] pb-8">
        <div className="flex flex-col gap-[24px] max-w-[1064px]">
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

          {/* All Projects */}
          <ProjectBoard
            isLoading={isLoading}
            projectList={projects}
            session={session}
            projectBoardContext={ProjectBoardContext.MyProjects}
          />

          {/* Discord CTA on projects page (only for unauthenticated users) */}
          {!isAuthenticated && (
            <div className="mt-12">
              <DiscordCTA variant="default" />
            </div>
          )}
        </div>
      </PageContent>
      {!isAuthenticated && <Footer />}
    </PageContainer>
  );
}
