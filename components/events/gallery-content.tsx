"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Plus, Search } from "lucide-react";
import ProjectBoard from "@/features/projects/components/displays/ProjectBoard/ProjectBoard";
import { ProjectBoardContext, Project } from "@/lib/types";
interface GalleryContentProps {
  eventId: string;
  slug: string;
  hasJoined: boolean;
  userRole?: string | null;
}

export function GalleryContent({
  eventId,
  slug,
  hasJoined,
  userRole,
}: GalleryContentProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchProjects = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/projects?eventId=${eventId}&public=true`
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
      <div className="bg-transparent border border-[rgba(0,0,0,0.15)] rounded-xl flex gap-3 items-center px-3 py-2 mb-6 w-[560px]">
        <Search className="w-6 h-6 text-black shrink-0" />
        <input
          type="text"
          placeholder="Search projects by name or team members"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="font-normal text-[16px] leading-[1.5] text-black placeholder:text-[rgba(0,0,0,0.6)] bg-transparent border-none outline-none flex-1"
        />
      </div>

      {/* Create Project Button - Only show for participants and organizers */}
      {hasJoined &&
        (userRole === "participant" || userRole === "organizer") && (
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
