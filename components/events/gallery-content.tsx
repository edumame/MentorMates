"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EventSearchInput } from "@/components/ui/event-search-input";
import { Plus } from "lucide-react";
import ProjectBoard from "@/features/projects/components/displays/ProjectBoard/ProjectBoard";
import { ProjectBoardContext, Project, EventRole } from "@/lib/types";

interface GalleryContentProps {
  eventId: string;
  slug: string;
  hasJoined: boolean;
  userRole?: string | null;
  currentRole?: EventRole | null;
}

export function GalleryContent({
  eventId,
  slug,
  hasJoined,
  userRole,
  currentRole,
}: GalleryContentProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchProjects = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/projects?eventId=${eventId}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch projects");
        }
        const data = await response.json();
        setProjects(data.projects || []);
      } catch (error) {
        console.error("Error fetching projects:", error);
        setProjects([]);
      }
      setIsLoading(false);
    };

    fetchProjects();
  }, [eventId]);

  const filteredProjects = projects.filter(
    (project) =>
      project.project_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.project_description
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col flex-1 w-full">
      {/* Search Bar */}
      <EventSearchInput
        wrapperClassName="mb-6 w-full max-w-[560px]"
        placeholder="Search projects by name or team members"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        inputClassName="text-[16px] leading-[1.5] sm:text-[16px]"
      />

      {/* Create Project Button - Only show for participants and organizers */}
      {hasJoined &&
        currentRole === EventRole.Participant &&
        (userRole === EventRole.Organizer ||
          userRole === EventRole.Participant) && (
          <div className="mb-6">
            <Link href={`/projects/submit?eventId=${slug}`}>
              <Button className="button-gradient text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Create Project
              </Button>
            </Link>
          </div>
        )}

      {/* Project Board */}
      <ProjectBoard
        isLoading={isLoading}
        projectList={filteredProjects}
        projectBoardContext={ProjectBoardContext.EventGallery}
      />
    </div>
  );
}
