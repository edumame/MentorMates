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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Delete } from "@mui/icons-material";
import { toast } from "@/lib/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSearchParams } from "next/navigation";

export default function ProjectsPage() {
  const { session, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const hasInviteNotifications = useMemo(
    () => notifications.some((n) => n.type === "project_invite" && n.status === "unread"),
    [notifications]
  );

  useEffect(() => {
    const getSession = async () => {
      if (session?.user?.email) {
        await Promise.all([fetchProjects(), fetchInvites(), fetchNotifications()]);
      }
      setIsLoading(false);
    };

    getSession();
  }, [session]);

  // Preserve invite context for post-login redirect
  useEffect(() => {
    if (!session) {
      const projectId = searchParams.get("inviteProject");
      const hash = searchParams.get("hash");
      if (projectId && hash) {
        try {
          localStorage.setItem(
            "returnUrl",
            window.location.pathname + window.location.search
          );
        } catch {
          // ignore
        }
      }
    }
  }, [session, searchParams]);

  // Handle redirect from email invite preserving project context
  useEffect(() => {
    const projectId = searchParams.get("inviteProject");
    const hash = searchParams.get("hash");
    if (projectId && hash && session?.user) {
      // Auto-accept via API, which will also join event if needed, then redirect
      (async () => {
        try {
          const res = await fetch("/api/projects/invitations/accept", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId, hash }),
          });
          const data = await res.json();
          if (res.ok) {
            router.replace(data.redirectUrl || `/projects/${projectId}`);
          }
        } catch {
          // ignore
        }
      })();
    }
  }, [searchParams, session]);

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

  const fetchInvites = async () => {
    try {
      const res = await fetch("/api/projects/invitations");
      if (!res.ok) return;
      const data = await res.json();
      setPendingInvites(data.invites || []);
    } catch (e) {
      console.error("Error fetching invites", e);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch (e) {
      console.error("Error fetching notifications", e);
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
    if (project.event_id) {
      router.push(
        `/projects/submit?eventId=${project.event_id}?projectId=${project.id}`
      );
    } else {
      toast({
        title: "Cannot edit project",
        description: "This project is not associated with an event.",
        variant: "destructive",
      });
    }
  };

  const handleAcceptInvite = async (invite: any) => {
    try {
      const res = await fetch("/api/projects/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId: invite.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to accept invite");
      // Refresh lists
      await Promise.all([fetchProjects(), fetchInvites(), fetchNotifications()]);
      router.push(data.redirectUrl || `/projects/${invite.project_id}`);
    } catch (e: any) {
      toast({ title: "Failed to accept", description: e.message, variant: "destructive" });
    }
  };

  const handleDismissInvite = async (invite: any) => {
    try {
      const ids = notifications
        .filter(
          (n) =>
            n.type === "project_invite" &&
            n.status === "unread" &&
            (n.data?.projectId === invite.project_id || n.data?.project_id === invite.project_id)
        )
        .map((n) => n.id);
      if (ids.length === 0) return;
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      await fetchNotifications();
    } catch (e) {
      console.error("Failed to dismiss notification", e);
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

  const submittedProjects = projects.filter((p) => p.submitted);
  const draftProjects = projects.filter((p) => !p.submitted);

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

          {/* Draft Projects + Pending Invites Section */}
          {isAuthenticated && (draftProjects.length > 0 || pendingInvites.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Draft Projects</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Notifications banner for invites */}
                {hasInviteNotifications && (
                  <Alert>
                    <AlertDescription>
                      You were invited to a project at an event.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Pending Invited Projects */}
                {pendingInvites.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm text-gray-700">Invited Projects</h3>
                    <ul className="space-y-3">
                      {pendingInvites.map((invite) => (
                        <li key={invite.id} className="border rounded p-3">
                          <div className="flex items-start justify-between gap-4">
                            <button
                              onClick={() => router.push(`/projects/${invite.project_id}`)}
                              className="text-left flex-grow hover:text-blue-600"
                            >
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">
                                  {invite.projects?.project_name || "Untitled Project"}
                                </h4>
                                <Badge variant="secondary">Pending invite</Badge>
                              </div>
                              {invite.projects?.project_description && (
                                <p className="text-sm text-gray-600 line-clamp-2">
                                  {invite.projects.project_description}
                                </p>
                              )}
                            </button>
                            <div className="flex items-center gap-2">
                              <Button size="sm" onClick={() => handleAcceptInvite(invite)}>
                                Accept & open
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push(`/projects/${invite.project_id}`)}
                              >
                                Open
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDismissInvite(invite)}>
                                Dismiss
                              </Button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* User Draft Projects */}
                {draftProjects.length > 0 && (
                  <div>
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
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Submitted Projects Section */}
          <div className="space-y-4">
            <h2 className="text-[20px] font-semibold leading-[1.4] tracking-[-0.06em] text-black">
              Submitted Projects
            </h2>
            <ProjectBoard
              isLoading={isLoading}
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
        </div>
      </PageContent>
      {!isAuthenticated && <Footer />}
    </PageContainer>
  );
}
