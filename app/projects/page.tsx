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
import { EventSearchInput } from "@/components/ui/event-search-input";

type FilterType = "all" | "public" | "mine";

export default function ProjectsPage() {
  const { session, isAuthenticated } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");

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

  // Remove the deleted project locally so the gallery updates immediately
  const handleProjectDeleted = (projectId: string) => {
    setProjects((prevProjects) =>
      prevProjects.filter((project) => project.id !== projectId)
    );
    // Re-fetch from the API to stay in sync with the server state
    fetchProjects();
  };

  const filteredProjects = useMemo(() => {
    let filtered = projects;

    // Apply filter type
    if (filterType === "public") {
      filtered = filtered.filter((p) => p.submitted === true);
    } else if (filterType === "mine") {
      filtered = filtered.filter(
        (p) => p.lead_email === session?.user?.email
      );
    }
    // "all" shows all projects, no additional filtering needed

    // Apply search term
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      filtered = filtered.filter((p) =>
        (p.project_name || "").toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [projects, searchTerm, filterType, session?.user?.email]);

  // All deletion and QR actions are handled inside the ProjectBoard component menu.

  return (
    <PageContainer showBorder={isAuthenticated}>
      <Toaster />
      <PageContent className="pt-[24px] pb-8">
        <div className="flex flex-col gap-[24px] px-[32px]">
          <div className="flex items-center justify-between mb-4">
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
          {/** hide search section for now */}
          {false && session && !isLoading && (
            <div className="flex flex-col mb-5 gap-4">
              <div className="flex items-end justify-between gap-4">
                {/* Search Input */}
                <EventSearchInput
                  wrapperClassName="flex-1"
                  placeholder="Search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />

                {/* Create Project Button - Desktop only */}
                {isAuthenticated && (
                  <Button asChild className="h-10 hidden sm:inline-flex">
                    <Link href="/projects/submit">Create a project</Link>
                  </Button>
                )}
              </div>

              {/* Create Project Button - Mobile only */}
              {isAuthenticated && (
                <Button asChild className="h-10 sm:hidden w-full">
                  <Link href="/projects/submit">Create a project</Link>
                </Button>
              )}
            </div>
          )}

          {/* Project Filter */}
          {session && !isLoading && projects.length > 0 && (
            <div className="flex items-center bg-white border border-[rgba(0,0,0,0.15)] rounded-xl p-1 w-full sm:w-fit">
              <button
                onClick={() => setFilterType("all")}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all border border-transparent ${filterType === "all"
                  ? "bg-white border !border-[rgba(0,0,0,0.15)] text-black font-semibold"
                  : "text-black hover:text-black/80"
                  }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType("public")}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all border border-transparent ${filterType === "public"
                  ? "bg-white border !border-[rgba(0,0,0,0.15)] text-black font-semibold"
                  : "text-black hover:text-black/80"
                  }`}
              >
                Public
              </button>
              <button
                onClick={() => setFilterType("mine")}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all border border-transparent ${filterType === "mine"
                  ? "bg-white border !border-[rgba(0,0,0,0.15)] text-black font-semibold"
                  : "text-black hover:text-black/80"
                  }`}
              >
                Mine
              </button>
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
                  onProjectDeleted={handleProjectDeleted}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-[rgba(0,0,0,0.15)] rounded-[20px] p-8">
                  <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M11 3V11L14 8L17 11V3M5 3H19C20.1046 3 21 3.89543 21 5V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3Z" stroke="#09090B"></path></svg>
                  <h3 className="text-2xl font-medium text-gray-900 mb-2 mt-4">
                    No project yet
                  </h3>
                  <p className="text-gray-500 max-w-sm">
                    {searchTerm
                      ? `No projects match your search "${searchTerm}". Try adjusting your search terms.`
                      : "Join the event to submit a project or create a project directly."}
                  </p>
                  <Button className="mt-4">
                    <Link href="/projects/submit">Create a project</Link>
                  </Button>
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
      <Footer />
    </PageContainer>
  );
}
