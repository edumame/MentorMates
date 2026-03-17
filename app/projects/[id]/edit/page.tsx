"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { PageContainer, PageContent } from "@/components/layout/PageContainer";
import { Loader2 } from "lucide-react";
import { Session } from "@supabase/supabase-js";
import { toast } from "@/lib/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { Project } from "@/lib/types";
import DraftProjectSubmissionFormSinglePage from "@/features/projects/components/forms/DraftProjectSubmissionFormSinglePage";

export default function ProjectEditPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [session, setSession] = useState<Session | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);
    };

    getSession();
  }, []);

  const fetchProject = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/projects?projectId=${projectId}`);
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        project?: Project;
      };

      if (!response.ok || !payload.project) {
        toast({
          title: "Error",
          description: payload.error || "Failed to load project",
          variant: "destructive",
        });
        router.push("/projects");
        return;
      }

      setProject(payload.project);

      // Check if user can edit
      if (session?.user?.email) {
        const userEmail = session.user.email;
        const isLead = payload.project.lead_email === userEmail;
        const isTeammate = payload.project.teammates?.includes(userEmail);
        const canEditProject = isLead || isTeammate;

        if (!canEditProject) {
          toast({
            title: "Access Denied",
            description: "You don't have permission to edit this project",
            variant: "destructive",
          });
          router.push(`/projects/${projectId}`);
          return;
        }

        setCanEdit(canEditProject);
      }
    } catch {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      router.push("/projects");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, router, session?.user?.email]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchProject();
    }
  }, [session?.user?.email, fetchProject]);

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center flex-grow">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </PageContainer>
    );
  }

  if (!project || !canEdit) {
    return null;
  }

  return (
    <PageContainer>
      <Toaster />
      <PageContent className="flex flex-col">
        <DraftProjectSubmissionFormSinglePage
          projectId={projectId}
          session={session}
          project={project}
          canEdit={canEdit}
          onProjectUpdate={setProject}
        />
      </PageContent>
    </PageContainer>
  );
}
