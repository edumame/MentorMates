"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import ProjectBoard from "@/features/projects/components/displays/ProjectBoard/ProjectBoard";
import { Project, ProjectBoardContext } from "@/lib/types";
import { DiscordCTA } from "@/components/ui/discord-cta";
import { Footer } from "@/components/layout/Footer";
import { useAuth } from "@/features/user/authentication/auth/AuthContext";
import { PageContainer, PageContent } from "@/components/layout/PageContainer";
import { Search } from "lucide-react";

export default function ProjectsPage() {
  const { session, isAuthenticated } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

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

  const filteredProjects = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return projects;
    return projects.filter((p) =>
      (p.project_name || "").toLowerCase().includes(term)
    );
  }, [projects, searchTerm]);

  // All deletion and QR actions are handled inside the ProjectBoard component menu.

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

          {/* Search Section - mirrors events page styling */}
          {session && !isLoading && (
            <div className="flex flex-col mb-5 gap-4">
              <div className="relative w-full">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-[rgba(0,0,0,0.6)]">
                  <Search className="w-full h-full" strokeWidth={2} />
                </div>
                <input
                  type="text"
                  placeholder="Search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-10 bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-12 py-2 text-xs sm:text-base font-normal text-black placeholder:text-[rgba(0,0,0,0.6)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

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
              {/* Filtered Projects List */}
              {filteredProjects.length > 0 ? (
                <ProjectBoard
                  isLoading={isLoading}
                  projectList={filteredProjects}
                  session={session}
                  projectBoardContext={ProjectBoardContext.MyProjects}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <svg
                    className="h-16 w-16 text-gray-400 mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No projects found
                  </h3>
                  <p className="text-gray-500 max-w-sm">
                    {searchTerm
                      ? `No projects match your search "${searchTerm}". Try adjusting your search terms.`
                      : "No projects to display."}
                  </p>
                </div>
              )}

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
