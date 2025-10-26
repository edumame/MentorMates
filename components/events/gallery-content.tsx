"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Search } from "lucide-react";
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
    <div className="flex flex-1 flex-wrap w-full gap-8">
      {
        Array.from({ length: 10 }).map((_, index) => (
          <img key={index} src={`/img/event.png`} alt="Event Gallery" className="sm:h-[15rem] w-full sm:w-[15rem] rounded-xl" />
        ))
      }
    </div>
  );
}
