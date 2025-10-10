"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Session } from "@supabase/supabase-js";
import { Toaster } from "@/components/ui/toaster";
import ProjectBoard from "@/features/projects/components/displays/ProjectBoard/ProjectBoard";
import { Project, ProjectBoardContext } from "@/lib/types";
import { DiscordCTA } from "@/components/ui/discord-cta";
import { Footer } from "@/components/layout/Footer";
import { useAuth } from "@/features/user/authentication/auth/AuthContext";

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
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
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
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${isAuthenticated ? 'lg:rounded-tl-2xl lg:border-t lg:border-l lg:border-[#D8D8D8] bg-white' : ''}`} style={isAuthenticated ? { background: "linear-gradient(196.644deg, rgba(219, 234, 254, 0.25) 13.188%, rgba(255, 255, 255, 0) 65.83%), linear-gradient(90deg, rgb(251, 252, 254) 0%, rgb(251, 252, 254) 100%)" } : { background: "linear-gradient(203deg, rgba(219, 234, 254, 0.25) 13.19%, rgba(255, 255, 255, 0.00) 65.83%), #FFF" }}>
      <Toaster />
      <div className="flex-grow px-[32px] pt-[32px] pb-0">
        <div className="flex flex-col gap-[24px] max-w-[1064px] mx-auto">
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-[8px]">
              <h1 className="text-[20px] sm:text-[28px] font-semibold leading-[1.4] tracking-[-0.06em] text-black">
                Project
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
          <ProjectBoard
            isLoading={isLoading}
            projectList={projects}
            session={session}
            projectBoardContext={ProjectBoardContext.MyProjects}
          />

          {/* Discord CTA on projects page */}
          <div className="mt-12">
            <DiscordCTA variant="default" />
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
