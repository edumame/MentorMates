"use client";
import { useProjectDetailLoader } from "@/features/projects/hooks/use-project-detail-loader";
import { ProjectDetailTabs } from "@/features/projects/components/displays/ProjectDetailTabs";
import { ProjectLoadError } from "@/features/projects/components/displays/ProjectLoadError";

import { saveProjectMaterials } from "@/features/projects/client-actions/client-materials";
import { useEffect, useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  ProjectSubmittedToCard,
  SUBMITTED_TO_EVENT_COLUMNS,
} from "@/features/projects/components/displays/ProjectSubmittedToCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Users,
  Calendar,
  QrCode,
  Copy,
  ExternalLink,
  Trash2,
  UserPlus,
  Edit,
  Heart,
  Loader,
  ArrowUpRight,
  Link as LinkIcon,
  Video,
  Lightbulb,
  Download,
  Check,
  AlertTriangle,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Session } from "@supabase/supabase-js";
import { ProjectFeedbackSection } from "@/features/projects/components/displays/ProjectFeedbackSection";
import { GiveFeedbackDialog } from "@/features/projects/components/feedback/GiveFeedbackDialog";
import { useQRCodeActions } from "@/features/projects/components/management/project-dashboard/hooks/useQRCodeActions";
import { toast } from "@/lib/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { Project } from "@/lib/types";
import { EditableField } from "@/components/ui/editable-field";
import { updateProjectClient } from "@/features/projects/client-actions/client-update";
import { updateProjectTeamClient } from "@/features/projects/client-actions/client-update";
import { deleteProjectClient } from "@/features/projects/client-actions/client-delete";
import { TrackSelector } from "@/features/projects/components/tracks/TrackSelector";
import { useProjectEventTracks } from "@/features/projects/hooks/use-project-event-tracks";
import { ProjectQRCodeSection } from "@/features/projects/components/displays/project-dashboard/ProjectQRCodeSection";
import ProjectTimeline from "@/features/projects/components/displays/ProjectTimeline";
import { ProjectSubmissionDetails } from "@/features/projects/components/displays/ProjectSubmissionDetails";
import { ProjectFieldEntriesSection } from "@/features/projects/components/displays/ProjectFieldEntriesSection";
import { FileUpload } from "@/components/db/fileUpload";
import { ImageUpload } from "@/components/db/imageUpload";
import { VideoEmbed, canEmbed } from "@/components/utils";
import { createContextusProject } from "@/lib/integrations/contextus";
import { useAdmin } from "@/lib/hooks/use-admin";
import { useProjectLike } from "@/features/projects/hooks/use-project-like";
import { PageContainer, PageContent } from "@/components/layout/PageContainer";
import UserSearchWithInvite from "@/components/utils/UserSearchWithInvite";
import { EditNote, Favorite } from "@mui/icons-material";
import { buildArtifactsFromLegacy } from "@/features/projects/utils/submission";
import {
  CoverImageWithFallback,
  ProjectCoverHero,
} from "@/features/projects/components/displays/cover-image-with-fallback";
import { ProjectDescription } from "@/components/projects/ProjectDescription";
import { ProjectShareSection } from "@/features/projects/components/displays/ProjectShareSection";
import {
  ProjectTeamMembersList,
  ProjectTeamSidebar,
} from "@/features/projects/components/displays/ProjectTeam";
import { ProjectEventRemovedNote } from "@/features/projects/components/displays/ProjectEventRemovedNote";
import { getProjectFeedbackUrl } from "@/features/projects/utils/feedback-url";
import { ProjectPrivateShareNotice } from "@/features/projects/components/displays/ProjectPrivateShareNotice";
import { getProjectTeamDisplayMembers } from "@/features/projects/utils/team-display";
import { parseUtcTimestamp } from "@/lib/utils/parse-utc-timestamp";

interface EventParticipant {
  user_id: string;
  display_name: string;
  email: string;
}

interface EventDetails {
  event_id: string;
  event_name: string;
  slug: string;
  start_date: string;
  end_date: string;
  location?: string;
  event_type?: string[];
  cover_image_url?: string;
  paid?: boolean | null;
  event_blurb?: string | null;
}

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const isAdmin = useAdmin();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionPending, setSessionPending] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Loading state for updates
  const [isUpdating, setIsUpdating] = useState(false);
  const hasEventTracks = useProjectEventTracks(project?.event_id);

  // Participant search state
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);

  // Event details state
  const [eventDetails, setEventDetails] = useState<EventDetails | null>(null);
  const [feedbackCount, setFeedbackCount] = useState(0);

  // Contextus ID state
  const [showContextusId, setShowContextusId] = useState(false);

  // Active tab state
  const [activeTab, setActiveTab] = useState("overview");

  // Give Feedback Dialog state
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);


  const setProjectWithArtifacts = useCallback((nextProject: Project) => {
    const fallbackArtifacts = buildArtifactsFromLegacy({
      project_url: nextProject.project_url,
      video_url: nextProject.video_url,
      additional_materials_url: nextProject.additional_materials_url,
    });
    setProject((prev) => ({
      ...nextProject,
      artifacts:
        nextProject.artifacts ||
        (prev?.id === nextProject.id ? prev.artifacts : undefined) ||
        fallbackArtifacts,
    }));
  }, []);

  // QR Code functionality
  const { handleCopyQR, handleDownloadQR } = useQRCodeActions(
    project?.event_id || "",
    projectId,
    project?.project_name
  );

  // Likes state
  const {
    liked,
    count: likesCount,
    isLoading: likeIsLoading,
    error: likeError,
    toggleLike,
  } = useProjectLike(projectId);

  useEffect(() => {
    if (likeError === "unauthorized") {
      toast({
        title: "Sign in required",
        description: "Please log in to like projects.",
      });
      router.push(`/login?returnUrl=/projects/${projectId}`);
    }
  }, [likeError, router, projectId]);

  useEffect(() => {
    let current = true;
    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (current) setSession(session);
      } catch {
        if (current) setSession(null);
      } finally {
        if (current) setSessionPending(false);
      }
    };
    void getSession();
    return () => { current = false; };

  }, []);

  const { isLoading, fetchComplete, loadError, retryProject } = useProjectDetailLoader(projectId, (nextProject) => {
    if (!nextProject) { setProject(null); setCanEdit(false); return; }
    setProjectWithArtifacts({ ...nextProject, artifacts: nextProject.artifacts || undefined });
    const email = session?.user?.email?.toLowerCase();
    setCanEdit(Boolean(email && (nextProject.lead_email?.toLowerCase() === email || nextProject.teammates?.some(value => value.toLowerCase() === email))));
  }, Boolean(session?.user?.email), "authenticated");

  // Fetch event details and feedback count when project is loaded
  useEffect(() => {
    const fetchEventDetailsAndFeedback = async () => {
      if (!project?.event_id || !project?.id) return;

      try {
        const [eventResult, feedbackResult] = await Promise.all([
          supabase
            .from("events")
            .select(SUBMITTED_TO_EVENT_COLUMNS)
            .eq("event_id", project.event_id)
            .single(),
          supabase
            .from("feedback")
            .select("id", { count: "exact", head: true })
            .eq("project_id", project.id),
        ]);

        // Handle event data
        if (!eventResult.error && eventResult.data) {
          setEventDetails({
            event_id: eventResult.data.event_id,
            event_name: eventResult.data.event_name,
            slug: eventResult.data.slug || "",
            start_date: eventResult.data.event_date,
            end_date: eventResult.data.event_date,
            location: eventResult.data.location || undefined,
            event_type: eventResult.data.event_type || undefined,
            cover_image_url: eventResult.data.cover_image_url || undefined,
            paid: eventResult.data.paid,
            event_blurb: eventResult.data.event_blurb,
          });
        }

        // Handle feedback count
        if (!feedbackResult.error) {
          setFeedbackCount(feedbackResult.count || 0);
        }
      } catch (error) {
        // Silently fail if data cannot be fetched
        console.error("Error fetching event details and feedback:", error);
      }
    };

    fetchEventDetailsAndFeedback();
  }, [project?.event_id, project?.id]);

  useEffect(() => {
    if (!hasEventTracks && activeTab === "tracks") {
      setActiveTab("overview");
    }
  }, [hasEventTracks, activeTab]);

  const handleUpdateTitle = async (newTitle: string): Promise<boolean> => {
    setIsUpdating(true);
    try {
      const { data, error } = await updateProjectClient(projectId, {
        project_name: newTitle,
      });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update project title",
          variant: "destructive",
        });
        return false;
      }

      setProjectWithArtifacts(data as Project);
      toast({
        title: "Success",
        description: "Project title updated successfully",
      });
      return true;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update project title",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateDescription = async (
    newDescription: string
  ): Promise<boolean> => {
    setIsUpdating(true);
    try {
      const { data, error } = await updateProjectClient(projectId, {
        project_description: newDescription,
      });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update project description",
          variant: "destructive",
        });
        return false;
      }

      setProjectWithArtifacts(data as Project);
      toast({
        title: "Success",
        description: "Project description updated successfully",
      });
      return true;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update project description",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSubmitToEvent = async (): Promise<void> => {
    setIsUpdating(true);
    try {
      const response = await fetch("/api/projects/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, submitted: true }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        toast({
          title: "Submission failed",
          description: errorData?.error || "Could not submit project to event.",
          variant: "destructive",
        });
        return;
      }

      const { data } = await response.json();
      setProjectWithArtifacts(data as Project);
      toast({
        title: "Submitted to event",
        description: "Your project is now visible to judges.",
      });
    } catch (err) {
      toast({
        title: "Submission failed",
        description:
          err instanceof Error ? err.message : "Unknown error. Try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateProjectUrl = async (newUrl: string): Promise<boolean> => {
    setIsUpdating(true);
    try {
      if (newUrl.trim() !== "") {
        try {
          new URL(newUrl);

          if (!newUrl.startsWith("http://") && !newUrl.startsWith("https://")) {
            toast({
              title: "Invalid URL",
              description: "URL must start with http:// or https://",
              variant: "destructive",
            });
            return false;
          }
        } catch {
          toast({
            title: "Invalid URL",
            description: "Please enter a valid URL (e.g., https://example.com)",
            variant: "destructive",
          });
          return false;
        }
      }

      const { data, error } = await updateProjectClient(projectId, {
        project_url: newUrl.trim() || undefined,
      });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update project URL",
          variant: "destructive",
        });
        return false;
      }

      setProjectWithArtifacts(data as Project);
      toast({
        title: "Success",
        description: newUrl.trim()
          ? "Project URL updated successfully"
          : "Project URL cleared successfully",
      });
      return true;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update project URL",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateCoverImage = async (newUrl: string): Promise<boolean> => {
    setIsUpdating(true);
    try {
      if (newUrl.trim() !== "") {
        try {
          new URL(newUrl);

          if (!newUrl.startsWith("http://") && !newUrl.startsWith("https://")) {
            toast({
              title: "Invalid URL",
              description: "URL must start with http:// or https://",
              variant: "destructive",
            });
            return false;
          }
        } catch {
          toast({
            title: "Invalid URL",
            description:
              "Please enter a valid image URL (e.g., https://example.com/image.jpg)",
            variant: "destructive",
          });
          return false;
        }
      }

      const { data, error } = await updateProjectClient(projectId, {
        cover_image_url: newUrl.trim() || undefined,
      });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update cover image",
          variant: "destructive",
        });
        return false;
      }

      setProjectWithArtifacts(data as Project);
      toast({
        title: "Success",
        description: newUrl.trim()
          ? "Cover image updated successfully"
          : "Cover image cleared successfully",
      });
      return true;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update cover image",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCoverImageFileUpload = async (file: File): Promise<boolean> => {
    setIsUpdating(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `project-covers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("project-materials")
        .upload(filePath, file);

      if (uploadError) {
        toast({
          title: "Upload Error",
          description: "Failed to upload image file",
          variant: "destructive",
        });
        return false;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("project-materials").getPublicUrl(filePath);

      const { data, error } = await updateProjectClient(projectId, {
        cover_image_url: publicUrl,
      });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update cover image",
          variant: "destructive",
        });
        return false;
      }

      setProjectWithArtifacts(data as Project);
      toast({
        title: "Success",
        description: "Cover image uploaded and updated successfully",
      });
      return true;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload cover image",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateAdditionalMaterials = async (
    newUrl: string
  ): Promise<boolean> => {
    setIsUpdating(true);
    try {
      if (newUrl.trim() !== "") {
        try {
          new URL(newUrl);

          if (!newUrl.startsWith("http://") && !newUrl.startsWith("https://")) {
            toast({
              title: "Invalid URL",
              description: "URL must start with http:// or https://",
              variant: "destructive",
            });
            return false;
          }
        } catch {
          toast({
            title: "Invalid URL",
            description: "Please enter a valid URL (e.g., https://example.com)",
            variant: "destructive",
          });
          return false;
        }
      }

      if (!project) return false;
      const data = await saveProjectMaterials(project, newUrl.trim());

      setProjectWithArtifacts(data as Project);
      toast({
        title: "Success",
        description: newUrl.trim()
          ? "Additional materials URL updated successfully"
          : "Additional materials URL cleared successfully",
      });
      return true;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update additional materials URL",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateVideoUrl = async (newUrl: string): Promise<boolean> => {
    setIsUpdating(true);
    try {
      if (newUrl.trim() !== "") {
        try {
          new URL(newUrl);

          if (!newUrl.startsWith("http://") && !newUrl.startsWith("https://")) {
            toast({
              title: "Invalid URL",
              description: "URL must start with http:// or https://",
              variant: "destructive",
            });
            return false;
          }
        } catch {
          toast({
            title: "Invalid URL",
            description:
              "Please enter a valid video URL (e.g., https://youtube.com/watch?v=...)",
            variant: "destructive",
          });
          return false;
        }
      }

      const { data, error } = await updateProjectClient(projectId, {
        video_url: newUrl.trim() || null,
      });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update video URL",
          variant: "destructive",
        });
        return false;
      }

      setProjectWithArtifacts(data as Project);
      toast({
        title: "Success",
        description: newUrl.trim()
          ? "Video URL updated successfully"
          : "Video URL cleared successfully",
      });
      return true;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update video URL",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  // Editing is private-only. Both public and private views read the shared
  // effective submission mapping; save its answer/artifact source here too.
  const handleAdditionalMaterialsFileUpload = async (
    file: File
  ): Promise<boolean> => {
    setIsUpdating(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `project-materials/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("project-materials")
        .upload(filePath, file);

      if (uploadError) {
        toast({
          title: "Upload Error",
          description: "Failed to upload file",
          variant: "destructive",
        });
        return false;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("project-materials").getPublicUrl(filePath);

      if (!project) return false;
      const data = await saveProjectMaterials(project, publicUrl);

      setProjectWithArtifacts(data as Project);
      toast({
        title: "Success",
        description: "Additional materials uploaded and updated successfully",
      });
      return true;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload additional materials",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteProject = async () => {
    setIsUpdating(true);
    try {
      const { success, error } = await deleteProjectClient(projectId);

      if (!success || error) {
        toast({
          title: "Error",
          description: "Failed to delete project",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Project deleted",
        description: "Your project has been successfully deleted",
      });

      router.push("/projects");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete project",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
      setShowDeleteDialog(false);
    }
  };

  const fetchEventParticipants = useCallback(async () => {
    if (!project?.event_id) return;

    setIsLoadingParticipants(true);
    try {
      const response = await fetch(
        `/api/events/${project.event_id}/users?roles=participant&limit=500`
      );
      const payload = await response.json();
      if (!response.ok) {
        return;
      }

      const participantList: EventParticipant[] = (payload.users || [])
        .filter((user: { email: string }) => Boolean(user.email))
        .map((user: { user_id: string; display_name: string; email: string }) => ({
          user_id: user.user_id,
          display_name: user.display_name || user.email || "",
          email: user.email || "",
        }));

      setParticipants(participantList);
    } catch (error) {
      // Silently fail if participants cannot be fetched
    } finally {
      setIsLoadingParticipants(false);
    }
  }, [project?.event_id]);

  useEffect(() => {
    if (project?.event_id) {
      fetchEventParticipants();
    }
  }, [project?.event_id, fetchEventParticipants]);

  const handleAddTeammate = async (email: string) => {
    const emailToAdd = email.trim();

    if (!emailToAdd) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailToAdd)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    const normalizedEmail = emailToAdd.toLowerCase();

    if (normalizedEmail === project?.lead_email?.toLowerCase()) {
      toast({
        title: "Cannot add lead",
        description: "The project lead is already part of the team",
        variant: "destructive",
      });
      return;
    }

    const currentTeammates = project?.teammates || [];
    if (
      currentTeammates.some(
        (teammate) => teammate.toLowerCase() === normalizedEmail
      )
    ) {
      toast({
        title: "Already a teammate",
        description: "This person is already a member of the team",
        variant: "destructive",
      });
      return;
    }

    try {
      const updatedTeammates = [...currentTeammates, normalizedEmail];
      const { data, error } = await updateProjectTeamClient(
        projectId,
        updatedTeammates
      );

      if (error) {
        toast({
          title: "Error",
          description: "Failed to add team member",
          variant: "destructive",
        });
        return;
      }

      setProjectWithArtifacts(data as Project);
      toast({
        title: "Team member added",
        description: `${normalizedEmail} has been successfully added to the team`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add team member",
        variant: "destructive",
      });
    }
  };

  const handleRemoveTeammate = async (teammateEmail: string) => {
    setIsUpdating(true);
    try {
      const currentTeammates = project?.teammates || [];
      const updatedTeammates = currentTeammates.filter(
        (email) => email !== teammateEmail
      );
      const { data, error } = await updateProjectTeamClient(
        projectId,
        updatedTeammates
      );

      if (error) {
        toast({
          title: "Error",
          description: "Failed to remove team member",
          variant: "destructive",
        });
        return;
      }

      setProjectWithArtifacts(data as Project);
      toast({
        title: "Team member removed",
        description: `${teammateEmail} has been removed from the team`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove team member",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateContextusLink = async () => {
    if (!project) return;

    setIsUpdating(true);
    try {
      const contextusPayload = {
        label: project.project_name,
        metadata: {
          event: eventDetails?.event_name || "Unknown Event",
          lead: project.lead_name,
          team_size: String((project.teammates?.length || 0) + 1),
        },
        artifacts: project.project_url
          ? {
              type: "link",
              title: "Project Repository",
              url: project.project_url,
            }
          : undefined,
      };

      const contextusId = await createContextusProject(contextusPayload);

      if (!contextusId) {
        toast({
          title: "Error",
          description: "Failed to create Contextus project",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await updateProjectClient(projectId, {
        contextus_project_id: contextusId,
      });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to save Contextus project ID",
          variant: "destructive",
        });
        return;
      }

      setProjectWithArtifacts(data as Project);
      toast({
        title: "Success",
        description: "Project linked to Contextus successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create Contextus link",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (sessionPending || isLoading || !fetchComplete) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center flex-grow">
          <div className="flex flex-col items-center gap-3">
            <Loader className="h-10 w-10 animate-spin text-blue-500" />
          </div>
        </div>
      </PageContainer>
    );
  }

  if (loadError) return <PageContainer><ProjectLoadError message={loadError} retry={retryProject} /></PageContainer>;

  if (!project) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center flex-grow">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Project not found</h1>
            <p className="text-gray-500 mb-4">
              The project you are looking for may have been deleted or is not available.
            </p>
            <Link href="/projects">
              <Button>Back to Projects</Button>
            </Link>
          </div>
        </div>
      </PageContainer>
    );
  }

  const isLead =
    session?.user?.email?.toLowerCase() === project.lead_email?.toLowerCase();
  const totalMembers = (project.teammates?.length || 0) + 1;
  // Same server-resolved roster as the public route. Emails are shown only
  // when the API included them, i.e. to team members, the event's organizers
  // and admins (project_team_emails); other signed-in viewers see names only.
  const canSeeTeamEmails = Boolean(project.lead_email);
  const teamMembers = getProjectTeamDisplayMembers(
    project,
    Object.fromEntries(
      participants.map((p) => [p.email.toLowerCase(), p.display_name])
    )
  );

  const feedbackUrl = getProjectFeedbackUrl(project.id);

  const projectArtifacts = project.artifacts || [];
  const extraProjectLinks = projectArtifacts.filter(
    (artifact) => artifact.kind === "project_link" && artifact.url !== project.project_url
  );
  const extraVideoLinks = projectArtifacts.filter(
    (artifact) => artifact.kind === "video_link" && artifact.url !== project.video_url
  );
  const extraMaterialLinks = projectArtifacts.filter(
    (artifact) =>
      artifact.kind === "additional_material" &&
      artifact.url !== project.additional_materials_url
  );
  const hasCoverImageSettings = Boolean(project.cover_image_url);
  const hasAdditionalMaterialsSettings =
    Boolean(project.additional_materials_url) || extraMaterialLinks.length > 0;
  const hasProjectUrlSettings =
    Boolean(project.project_url) || extraProjectLinks.length > 0;
  const hasVideoUrlSettings = Boolean(project.video_url);
  const hasVisibleProjectSettings =
    hasCoverImageSettings ||
    hasAdditionalMaterialsSettings ||
    hasProjectUrlSettings ||
    hasVideoUrlSettings;
  const extraActionLinks = [...extraProjectLinks, ...extraVideoLinks];

  return (
    <PageContainer>
      <Toaster />
      <PageContent>
        {/* Header Section */}
        <div
          className="border-gray-200"
          style={{
            background:
              "linear-gradient(to bottom, rgba(219, 234, 254, 0.45), rgba(255, 255, 255, 0) 13%, #fff)",
          }}
        >
          <div className="container mx-auto px-5 sm:px-8 pt-6 sm:pt-8 pb-0">
            {/* Top Actions Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
              {/* Metadata Badges */}
              <div className="flex items-center gap-2 flex-wrap overflow-x-auto pb-2">
                <Badge
                  variant="secondary"
                  className="bg-white border border-black/15 text-black px-3 py-1.5 rounded-full flex items-center gap-1 text-sm"
                >
                  <div className="font-normal flex items-center gap-1">
                    <Loader className="h-[18px] w-[18px]" />
                    {project.submitted ? "Submitted" : "Draft"}
                  </div>
                </Badge>
                <Badge
                  variant="secondary"
                  className="bg-white border border-black/15 text-black px-3 py-1.5 rounded-full flex items-center gap-1 text-sm"
                >
                  <div className="font-normal flex items-center gap-1">
                    <Calendar className="h-[18px] w-[18px]" />
                    Created:{" "}
                    {(parseUtcTimestamp(project.created_at) ?? new Date(project.created_at)).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                </Badge>
                <Badge
                  variant="secondary"
                  className="bg-white border border-black/15 text-black px-3 py-1.5 rounded-full flex items-center gap-1 text-sm"
                >
                  <div className="font-normal flex items-center gap-1">
                    <Users className="h-5 w-5" />
                    <span className="text-sm">{totalMembers} members</span>
                  </div>
                </Badge>
              </div>

              {/* Action Buttons - Desktop Only */}
              <div className="hidden sm:flex items-center gap-2 sm:gap-3 flex-wrap">
                <div
                  onClick={() => {
                    if (!session) {
                      toast({
                        title: "Sign in required",
                        description: "Please log in to like projects.",
                      });
                      router.push(`/login?returnUrl=/projects/${projectId}`);
                      return;
                    }
                    void toggleLike();
                  }}
                  className={`cursor-pointer rounded-xl px-4 sm:px-5 py-2 text-sm sm:text-base flex items-center`}
                >
                  {likeIsLoading ? (
                    <Loader className="h-5 w-5 sm:h-6 sm:w-6 mr-1.5" />
                  ) : (
                    <>
                      {liked ? (
                        <Favorite
                          className="h-5 w-5 sm:h-6 sm:w-6 mr-1.5"
                          style={{ fill: "#4B89EF" }}
                        />
                      ) : (
                        <Heart className="h-5 w-5 sm:h-6 sm:w-6 mr-1.5" fill="none" />
                      )}
                    </>
                  )}
                  <span className="whitespace-nowrap">{liked ? "Liked" : "Like"}</span>
                  {/* <span className="ml-2 text-sm">{likesCount}</span> */}
                </div>
                {canEdit ? (
                  <Button
                    onClick={() => router.push(`/projects/${projectId}/edit`)}
                    className="bg-[#4b89ef] hover:bg-[#3d75d9] text-white rounded-xl px-4 sm:px-5 py-2 shadow-sm text-sm sm:text-base whitespace-nowrap"
                  >
                    <EditNote className="h-5 w-5 sm:h-6 sm:w-6 mr-1.5" />
                    Edit
                  </Button>
                ) : (
                  <Button
                    onClick={() => setShowFeedbackDialog(true)}
                    className="bg-[#4b89ef] hover:bg-[#3d75d9] text-white rounded-xl px-4 sm:px-5 py-2 shadow-sm text-sm sm:text-base whitespace-nowrap"
                  >
                    Give feedback
                  </Button>
                )}
              </div>
            </div>

            {/* Submission Status Banner — clarifies published vs submitted.
                Hidden when the event was deleted: there is nothing to submit to. */}
            {canEdit && project.event_id && (
              <div
                className={`mb-6 rounded-[16px] border p-4 shadow-sm ${
                  project.submitted
                    ? "border-[rgba(0,0,0,0.08)] bg-white"
                    : "border-[#FDE68A] bg-[#FFFBEB]"
                }`}
              >
                {project.submitted ? (
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-5 w-5 rounded-full bg-[#DCFCE7] flex items-center justify-center shrink-0">
                      <Check className="h-3 w-3 text-[#16A34A]" strokeWidth={3} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#18181B] tracking-[-0.01em] leading-tight">
                        Submitted to event
                      </p>
                      <p className="text-[12px] text-[#7F7F7F] mt-0.5 leading-relaxed">
                        This project is submitted and visible to judges. You can
                        still edit it until the submission deadline.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-5 w-5 rounded-full bg-[#FEF3C7] flex items-center justify-center shrink-0">
                      <AlertTriangle className="h-3 w-3 text-[#D97706]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#18181B] tracking-[-0.01em] leading-tight">
                        Draft — not yet submitted to the event
                      </p>
                      <p className="text-[12px] text-[#7F7F7F] mt-0.5 leading-relaxed">
                        Your project is saved but hasn&apos;t been submitted. Publishing
                        a project is not the same as submitting it to an event —
                        click &quot;Submit to event&quot; for judges to see it.
                      </p>
                      <Button
                        className="mt-2.5 bg-[#4B89EF] hover:bg-[#3E7EEA] text-white rounded-[12px] h-8 px-4 text-[13px] font-semibold shadow-[inset_0_2px_1px_0_rgba(255,255,255,0.25),0_1px_2px_0_rgba(0,0,0,0.05)]"
                        onClick={handleSubmitToEvent}
                        disabled={isUpdating}
                      >
                        {isUpdating ? "Submitting…" : "Submit to event"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Project Title and Hero Section */}
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-20 mb-6 sm:mb-12">
              {/* Left: Title and Description */}
              <div className="flex-1 space-y-4 sm:space-y-8 order-1">
                <div className="flex flex-col gap-4">
                  {canEdit ? (
                    <EditableField
                      value={project.project_name}
                      onSave={handleUpdateTitle}
                      canEdit={canEdit}
                      isLoading={isUpdating}
                      displayClassName="text-2xl sm:text-3xl font-semibold text-black tracking-tight leading-8 sm:leading-9"
                      inputClassName="text-2xl sm:text-3xl font-semibold text-black tracking-tight leading-8 sm:leading-9"
                      renderDisplay={(value) => (
                        <h1 className="text-2xl sm:text-3xl font-semibold text-black tracking-tight leading-8 sm:leading-9 hover:text-blue-600">
                          {value}
                        </h1>
                      )}
                    />
                  ) : (
                    <h1 className="text-2xl sm:text-3xl font-semibold text-black tracking-tight leading-8 sm:leading-9">
                      {project.project_name}
                    </h1>
                  )}

                  {canEdit ? (
                    <EditableField
                      value={project.project_description}
                      onSave={handleUpdateDescription}
                      canEdit={canEdit}
                      isLoading={isUpdating}
                      multiline={true}
                      className="w-full"
                      displayClassName="w-full"
                      renderDisplay={(value) => (
                        <ProjectDescription
                          value={value}
                          variant="header"
                          truncateLines={4}
                          className="text-base sm:text-lg"
                        />
                      )}
                    />
                  ) : (
                    <ProjectDescription
                      value={project.project_description}
                      variant="header"
                      truncateLines={4}
                      className="text-base sm:text-lg"
                    />
                  )}
                </div>

                {/* Action Buttons for Project */}
                <div className="flex flex-wrap gap-3">
                  {project.project_url && (
                    <a
                      href={project.project_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button className="bg-[#4b89ef] hover:bg-[#3d75d9] text-white rounded-xl px-4 sm:px-6 py-2.5 shadow-sm text-sm sm:text-base">
                        <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5" />
                        <span className="whitespace-nowrap">View Live Project</span>
                      </Button>
                    </a>
                  )}
                  {project.video_url && (
                    <a
                      href={project.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        variant="secondary"
                        className="bg-black/5 hover:bg-black/10 rounded-xl px-4 sm:px-6 py-2.5 shadow-sm text-sm sm:text-base"
                      >
                        <Video className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5" />
                        <span className="whitespace-nowrap">Watch Video</span>
                      </Button>
                    </a>
                  )}
                  {extraProjectLinks.map((artifact, index) => (
                    <a
                      key={`${artifact.id || artifact.url}-project-${index}`}
                      href={artifact.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        variant="outline"
                        className="rounded-xl px-4 sm:px-6 py-2.5 shadow-sm text-sm sm:text-base"
                      >
                        <LinkIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5" />
                        <span className="whitespace-nowrap">{artifact.label}</span>
                      </Button>
                    </a>
                  ))}
                  {extraVideoLinks.map((artifact, index) => (
                    <a
                      key={`${artifact.id || artifact.url}-video-${index}`}
                      href={artifact.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        variant="outline"
                        className="rounded-xl px-4 sm:px-6 py-2.5 shadow-sm text-sm sm:text-base"
                      >
                        <Video className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5" />
                        <span className="whitespace-nowrap">{artifact.label}</span>
                      </Button>
                    </a>
                  ))}
                </div>
              </div>

              {/* Right: Cover Image */}
              <div className="w-full lg:w-[520px] h-[200px] sm:h-[250px] lg:h-[300px] rounded-2xl overflow-hidden shadow-lg order-2">
                {canEdit ? (
                  <div className="relative h-full w-full group">
                    <ProjectCoverHero
                      src={project.cover_image_url}
                      alt={`${project.project_name || "Project"} cover`}
                    >
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white text-sm">
                          Click to edit in settings below
                        </span>
                      </div>
                    </ProjectCoverHero>
                  </div>
                ) : (
                  <ProjectCoverHero
                    src={project.cover_image_url}
                    alt={`${project.project_name || "Project"} cover`}
                  />
                )}
              </div>
            </div>

            {/* Action Buttons - Mobile Only */}
            <div className="flex sm:hidden items-center gap-2 mb-6 overflow-x-auto pb-2 -mx-4 px-4">
              <div
                onClick={() => {
                  if (!session) {
                    toast({
                      title: "Sign in required",
                      description: "Please log in to like projects.",
                    });
                    router.push(`/login?returnUrl=/projects/${projectId}`);
                    return;
                  }
                  void toggleLike();
                }}
                className={`cursor-pointer rounded-xl px-4 py-2 text-sm flex items-center flex-shrink-0`}
              >
                {likeIsLoading ? (
                  <Loader className="h-5 w-5" />
                ) : (
                  <>
                    {liked ? (
                      <Favorite
                        className="h-5 w-5 mr-1.5"
                        style={{ fill: "#4B89EF" }}
                      />
                    ) : (
                      <Heart className="h-5 w-5 mr-1.5" fill="none" />
                    )}
                  </>
                )}
                <span className="whitespace-nowrap">{liked ? "Liked" : "Like"}</span>
              </div>
              {canEdit ? (
                <Button
                  onClick={() => router.push(`/projects/${projectId}/edit`)}
                  className="bg-[#4b89ef] hover:bg-[#3d75d9] text-white rounded-xl px-4 py-2 shadow-sm text-sm whitespace-nowrap flex-shrink-0"
                >
                  <Edit className="h-5 w-5 mr-1.5" />
                  Edit
                </Button>
              ) : (
                <Button
                  onClick={() => setShowFeedbackDialog(true)}
                  className="bg-[#4b89ef] hover:bg-[#3d75d9] text-white rounded-xl px-4 py-2 shadow-sm text-sm whitespace-nowrap flex-shrink-0"
                >
                  Give feedback
                </Button>
              )}
            </div>

            {/* Tabs Navigation */}
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <ProjectDetailTabs hasTracks={hasEventTracks} totalMembers={totalMembers} feedbackCount={feedbackCount} />

              {/* Main Content Area */}
              <div className="py-6 sm:py-12">
                <div className="flex flex-col lg:flex-row gap-6 sm:gap-10">
                  {/* Left Column: Main Content */}
                  <div className="flex-1 min-w-0 space-y-12">
                    <TabsContent
                      value="overview"
                      className="mt-0 overflow-hidden"
                    >
                      <div className="space-y-8">
                        {/* About this project */}
                        <div>
                          <h2 className="text-3xl font-semibold text-black mb-6 tracking-tight">
                            About this project
                          </h2>
                          {canEdit ? (
                            <EditableField
                              value={project.project_description}
                              onSave={handleUpdateDescription}
                              canEdit={canEdit}
                              isLoading={isUpdating}
                              multiline={true}
                              className="w-full"
                              displayClassName="w-full"
                              renderDisplay={(value) => (
                                <ProjectDescription value={value} className="text-base" />
                              )}
                            />
                          ) : (
                            <ProjectDescription
                              value={project.project_description}
                              className="text-base"
                            />
                          )}
                        </div>

                        <ProjectSubmissionDetails project={project} />

                        <ProjectFieldEntriesSection
                          projectId={project.id}
                          canContribute={canEdit}
                        />

                        {/* Cover Image Display */}
                        {project.cover_image_url && (
                          <div className="space-y-2 rounded-xl border border-black/10 p-3">
                            <div className="rounded-xl overflow-hidden">
                              <CoverImageWithFallback
                                src={project.cover_image_url}
                                alt="Project cover"
                                className="w-full h-auto object-cover"
                              />
                            </div>
                          </div>
                        )}

                        {/* Video Embed */}
                        {project.video_url && canEmbed(project.video_url) && (
                          <div className="space-y-4">
                            <VideoEmbed
                              url={project.video_url}
                              title="Project Video"
                            />
                          </div>
                        )}

                        {/* Session timeline. Intentionally private-route only (CLAUDE.md
                            parity exception): it lists mentor/AI session meetings with
                            scores, and meetings RLS only lets the team, judges and
                            organizers read them (202611030002), so the public route
                            would always render an empty card. */}
                        <div>
                          <ProjectTimeline projectId={project.id} />
                        </div>

                        {/* Settings Section - Only for editors */}
                        {canEdit && (hasVisibleProjectSettings || isLead) && (
                          <Card className="mt-12">
                            <CardHeader>
                              <CardTitle>Project Settings</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                              {/* Cover Image URL */}
                              {hasCoverImageSettings && (
                                <div>
                                  <div className="flex items-center gap-2 mb-3">
                                    <ExternalLink className="h-4 w-4 text-gray-500" />
                                    <label className="text-sm font-medium text-gray-700">
                                      Cover Image:
                                    </label>
                                  </div>

                                  <div className="mb-4">
                                    <label className="text-xs font-medium text-gray-600 mb-1 block">
                                      Image URL:
                                    </label>
                                    <div className="flex gap-2">
                                      <div className="flex-1">
                                        <EditableField
                                          value={project.cover_image_url || ""}
                                          onSave={handleUpdateCoverImage}
                                          canEdit={canEdit}
                                          isLoading={isUpdating}
                                          placeholder="https://example.com/image.jpg"
                                          displayClassName="text-blue-600 underline"
                                          renderDisplay={(value) =>
                                            value ? (
                                              <span className="text-blue-600 hover:text-blue-800 cursor-pointer break-all">
                                                {value}
                                              </span>
                                            ) : null
                                          }
                                        />
                                      </div>
                                      {project.cover_image_url && (
                                        <a
                                          href={project.cover_image_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex-shrink-0"
                                        >
                                          <Button variant="outline" size="sm">
                                            <ExternalLink className="h-4 w-4 mr-1" />
                                            View
                                          </Button>
                                        </a>
                                      )}
                                    </div>
                                  </div>

                                  <ImageUpload
                                    handleUpload={handleCoverImageFileUpload}
                                    noteText="Note: Changes to the cover image will be reflected in the header image above."
                                  />
                                </div>
                              )}

                              {/* Additional Materials */}
                              {hasAdditionalMaterialsSettings && (
                                <div className="border-t pt-6">
                                <div className="flex items-center gap-2 mb-3">
                                  <ExternalLink className="h-4 w-4 text-gray-500" />
                                  <label className="text-sm font-medium text-gray-700">
                                    Additional Materials:
                                  </label>
                                </div>

                                <div className="mb-4">
                                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                                    Additional Materials URL:
                                  </label>
                                  <div className="flex gap-2">
                                    <div className="flex-1">
                                      <EditableField
                                        value={
                                          project.additional_materials_url || ""
                                        }
                                        onSave={handleUpdateAdditionalMaterials}
                                        canEdit={canEdit}
                                        isLoading={isUpdating}
                                        placeholder="https://github.com/your-repo or https://docs.google.com/..."
                                        displayClassName="text-blue-600 underline"
                                        renderDisplay={(value) =>
                                          value ? (
                                            <span className="text-blue-600 hover:text-blue-800 cursor-pointer break-all">
                                              {value}
                                            </span>
                                          ) : null
                                        }
                                      />
                                    </div>
                                    {project.additional_materials_url && (
                                      <a
                                        href={project.additional_materials_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-shrink-0"
                                      >
                                        <Button variant="outline" size="sm">
                                          <ExternalLink className="h-4 w-4 mr-1" />
                                          View
                                        </Button>
                                      </a>
                                    )}
                                  </div>
                                </div>
                                <FileUpload
                                  handleUpload={
                                    handleAdditionalMaterialsFileUpload
                                  }
                                  noteText="Examples: GitHub repository, documentation, slides, design files, PDFs, etc."
                                />
                                </div>
                              )}

                              {/* Project URL */}
                              {hasProjectUrlSettings && (
                                <div className="border-t pt-6">
                                <div className="flex items-center gap-2 mb-2">
                                  <ExternalLink className="h-4 w-4 text-gray-500" />
                                  <label className="text-sm font-medium text-gray-700">
                                    Project URL:
                                  </label>
                                </div>
                                <div className="flex gap-2">
                                  <div className="flex-1">
                                    <EditableField
                                      value={project.project_url || ""}
                                      onSave={handleUpdateProjectUrl}
                                      canEdit={canEdit}
                                      isLoading={isUpdating}
                                      placeholder="https://your-project-url.com"
                                      displayClassName="text-blue-600 underline"
                                      renderDisplay={(value) =>
                                        value ? (
                                          <span className="text-blue-600 hover:text-blue-800 cursor-pointer break-all">
                                            {value}
                                          </span>
                                        ) : null
                                      }
                                    />
                                  </div>
                                  {project.project_url && (
                                    <a
                                      href={project.project_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex-shrink-0"
                                    >
                                      <Button variant="outline" size="sm">
                                        <ExternalLink className="h-4 w-4 mr-1" />
                                        Visit
                                      </Button>
                                    </a>
                                  )}
                                </div>

                                {extraProjectLinks.length > 0 && (
                                  <div className="mt-3 space-y-2">
                                    <label className="text-xs font-medium text-gray-600 block">
                                      Additional Project Links:
                                    </label>
                                    {extraProjectLinks.map((artifact, index) => (
                                      <div
                                        key={`${artifact.id || artifact.url}-settings-project-${index}`}
                                        className="flex gap-2"
                                      >
                                        <Input
                                          value={artifact.url}
                                          readOnly
                                          className="text-sm"
                                        />
                                        <a
                                          href={artifact.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex-shrink-0"
                                        >
                                          <Button variant="outline" size="sm">
                                            <ExternalLink className="h-4 w-4 mr-1" />
                                            Open
                                          </Button>
                                        </a>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                </div>
                              )}

                              {/* Video URL */}
                              {hasVideoUrlSettings && (
                                <div className="border-t pt-6">
                                <div className="flex items-center gap-2 mb-2">
                                  <ExternalLink className="h-4 w-4 text-gray-500" />
                                  <label className="text-sm font-medium text-gray-700">
                                    Video URL:
                                  </label>
                                </div>
                                <div className="flex gap-2">
                                  <div className="flex-1">
                                    <EditableField
                                      value={project.video_url || ""}
                                      onSave={handleUpdateVideoUrl}
                                      canEdit={canEdit}
                                      isLoading={isUpdating}
                                      placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
                                      displayClassName="text-blue-600 underline"
                                      renderDisplay={(value) =>
                                        value ? (
                                          <span className="text-blue-600 hover:text-blue-800 cursor-pointer break-all">
                                            {value}
                                          </span>
                                        ) : null
                                      }
                                    />
                                  </div>
                                  {project.video_url && (
                                    <a
                                      href={project.video_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex-shrink-0"
                                    >
                                      <Button variant="outline" size="sm">
                                        <ExternalLink className="h-4 w-4 mr-1" />
                                        Watch
                                      </Button>
                                    </a>
                                  )}
                                </div>
                                </div>
                              )}

                              {/* Delete Project Button */}
                              {isLead && (
                                <div className="border-t pt-6">
                                  <Button
                                    variant="destructive"
                                    onClick={() => setShowDeleteDialog(true)}
                                    disabled={isUpdating}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Project
                                  </Button>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </TabsContent>

                    {hasEventTracks && (
                      <TabsContent
                        value="tracks"
                        className="mt-0 overflow-hidden"
                      >
                        <TrackSelector
                          projectId={project.id}
                          eventId={project.event_id}
                          canEdit={canEdit}
                          isLoading={isUpdating}
                        />
                      </TabsContent>
                    )}

                    <TabsContent value="team" className="mt-0 overflow-visible">
                      <div className="w-full overflow-visible">
                        <ProjectTeamMembersList members={teamMembers} showEmails={canSeeTeamEmails} />

                        {canEdit && isLead && (
                          <div className="mt-8 rounded-xl border border-gray-200 bg-white p-4 sm:p-6 overflow-visible">
                            <div className="flex items-center gap-2 mb-3">
                              <UserPlus className="h-4 w-4 text-gray-500" />
                              <h4 className="font-medium text-gray-900">
                                Add team member
                              </h4>
                            </div>

                            <div className="relative overflow-visible">
                              <UserSearchWithInvite
                                allTags={participants.map(
                                  (p) =>
                                    `${p.display_name || p.email} (${p.email})`
                                )}
                                onTagsChange={(tags) => {
                                  // Extract emails from tags
                                  const emails = tags.map((tag) => {
                                    const emailMatch = tag.match(/\((.+?)\)$/);
                                    return emailMatch ? emailMatch[1] : tag;
                                  });

                                  // Get list of participant emails for validation
                                  const participantEmails = participants.map((p) =>
                                    p.email.toLowerCase()
                                  );

                                  // Only process emails that are actual event participants
                                  const validEmails = emails.filter((email) =>
                                    participantEmails.includes(email.toLowerCase())
                                  );

                                  // Find newly added emails (only from valid participants)
                                  const currentTeammates = project?.teammates || [];
                                  const newEmails = validEmails.filter(
                                    (email) =>
                                      !currentTeammates.some(
                                        (t) =>
                                          t.toLowerCase() === email.toLowerCase()
                                      )
                                  );

                                  // Find removed emails
                                  const removedEmails = currentTeammates.filter(
                                    (email) =>
                                      !validEmails.some(
                                        (e) => e.toLowerCase() === email.toLowerCase()
                                      )
                                  );

                                  // Handle additions (only for event participants)
                                  if (newEmails.length > 0) {
                                    newEmails.forEach((email) =>
                                      handleAddTeammate(email)
                                    );
                                  }

                                  // Handle removals
                                  if (removedEmails.length > 0) {
                                    removedEmails.forEach((email) =>
                                      handleRemoveTeammate(email)
                                    );
                                  }
                                }}
                                initialTags={(project?.teammates || []).map((email) => {
                                  const participant = participants.find(
                                    (p) =>
                                      p.email.toLowerCase() ===
                                      email.toLowerCase()
                                  );
                                  return participant
                                    ? `${participant.display_name || participant.email} (${participant.email})`
                                    : email;
                                })}
                                projectId={projectId}
                                enableInvite={true}
                              />
                            </div>

                            <p className="text-xs text-gray-500 mt-3">
                              Search for event participants to add them immediately, or
                              send an invitation to users not yet registered. Invited
                              users will be added to the team once they accept the
                              invitation.
                            </p>
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="feedback" className="mt-0 overflow-hidden">
                      <ProjectFeedbackSection projectId={project.id} onGiveFeedback={() => setShowFeedbackDialog(true)} />
                    </TabsContent>

                    {/* Sharing Tab */}
                    <TabsContent
                      value="sharing"
                      className="mt-0 overflow-hidden"
                    >
                      <div className="grid grid-cols-1 lg:grid-cols-[1fr,minmax(300px,500px)] gap-6 border border-zinc-200 rounded-md p-4 sm:p-6">
                        {/* Left Column: Share Card */}
                        <div>
                          <CardHeader>
                            <CardTitle className="text-[22px] font-semibold tracking-[-0.06em]">
                              Share & Get Feedback
                            </CardTitle>
                            <p className="text-sm text-zinc-500">
                              Share this project with others using the QR code
                              or direct link.
                            </p>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            {project.is_private && (
                              <ProjectPrivateShareNotice eventName={eventDetails?.event_name} />
                            )}
                            {/* Copy Link Section */}
                            <div className="space-y-2">
                              <div className="flex flex-col sm:flex-row gap-2">
                                <Input
                                  value={feedbackUrl}
                                  readOnly
                                  className="flex-1 bg-white min-w-0 text-sm"
                                />
                                <Button
                                  variant="secondary"
                                  className="bg-zinc-100 hover:bg-zinc-200 whitespace-nowrap"
                                  onClick={() => {
                                    navigator.clipboard.writeText(feedbackUrl);
                                    toast({
                                      title: "Copied!",
                                      description: "Link copied to clipboard",
                                    });
                                  }}
                                >
                                  Copy Link
                                </Button>
                              </div>
                            </div>

                            {/* Divider */}
                            <div className="border-t border-zinc-200" />

                            {/* QR Code Section */}
                            <div className="space-y-4">
                              <div className="w-full max-w-[206px] h-auto bg-white flex justify-center">
                                <QRCodeSVG
                                  id="project-qr-code"
                                  value={feedbackUrl}
                                  size={200}
                                  level="H"
                                  includeMargin={false}
                                  className="w-full h-auto"
                                />
                              </div>

                              <p className="text-sm text-black">
                                Scan this QR code to share and provide feedback
                              </p>

                              <div className="flex gap-3">
                                <Button
                                  variant="outline"
                                  className="border-[1.5px] border-[rgba(0,0,0,0.05)]"
                                  onClick={handleCopyQR}
                                >
                                  <Copy className="h-5 w-5 mr-2" />
                                  Copy
                                </Button>
                                <Button
                                  variant="outline"
                                  className="border-[1.5px] border-[rgba(0,0,0,0.05)]"
                                  onClick={handleDownloadQR}
                                >
                                  <Download className="h-5 w-5 mr-2" />
                                  Download
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </div>

                        {/* Right Column: Sharing Tips */}
                        <div
                          className="p-4 sm:p-6 space-y-4 sm:space-y-6"
                          style={{
                            background:
                              "linear-gradient(180deg, #DBEAFE 0%, #F9F9FF 100%)",
                          }}
                        >
                          <div className="bg-white rounded-[13px] p-1.5 w-fit">
                            <Lightbulb className="h-6 w-6" />
                          </div>

                          <div className="text-left">
                            <p className="font-medium text-base text-black">
                              Sharing Tips
                            </p>
                          </div>

                          <div className="space-y-3">
                            <div className="py-3 space-y-1">
                              <p className="text-[24px] font-sans text-zinc-900">
                                01
                              </p>
                              <p className="text-sm text-zinc-500 leading-[22px]">
                                Save the QR code image to share digitally
                              </p>
                            </div>

                            <div className="border-t border-gray-200" />

                            <div className="py-3 space-y-1">
                              <p className="text-[24px] font-sans text-zinc-900">
                                02
                              </p>
                              <p className="text-sm text-zinc-500 leading-[22px]">
                                Print it on business cards or project handouts
                              </p>
                            </div>

                            <div className="border-t border-gray-200" />

                            <div className="py-3 space-y-1">
                              <p className="text-[24px] font-sans text-zinc-900">
                                03
                              </p>
                              <p className="text-sm text-zinc-500 leading-[22px]">
                                Display it at your project booth or presentation
                              </p>
                            </div>

                            <div className="border-t border-gray-200" />

                            <div className="py-3 space-y-1">
                              <p className="text-[24px] font-sans text-zinc-900">
                                04
                              </p>
                              <p className="text-sm text-zinc-500 leading-[22px]">
                                Add it to your LinkedIn or GitHub profile
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </div>

                  {/* Right Column: Sidebar */}
                  {activeTab === "overview" && (
                    <div className="w-full lg:w-[420px] xl:w-[480px] lg:flex-shrink-0 space-y-6">
                      {/* Meet the team */}
                      <ProjectTeamSidebar members={teamMembers} showEmails={canSeeTeamEmails} />

                      {/* Divider */}
                      {activeTab === "overview" && (
                        <div className="border-t border-gray-200"></div>
                      )}

                      {/* Submitted to Event (or a note when the event was deleted) */}
                      {activeTab === "overview" && !project.event_id && <ProjectEventRemovedNote />}
                      {activeTab === "overview" && eventDetails && (
                        <ProjectSubmittedToCard event={eventDetails} />
                      )}

                      {/* Divider */}
                      {activeTab === "overview" && (
                        <div className="border-t border-gray-200"></div>
                      )}

                      {/* Additional links */}
                      {activeTab === "overview" && (
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-black tracking-tight mb-4">
                            Additional links
                          </h3>
                          <div className="space-y-2">
                            {extraActionLinks.length > 0 ? (
                              extraActionLinks.map((artifact, index) => (
                                <a
                                  key={`${artifact.id || artifact.url}-extra-link-${index}`}
                                  href={artifact.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block"
                                >
                                  <Button
                                    variant="secondary"
                                    className="w-full bg-black/5 hover:bg-black/10 rounded-xl py-2.5 shadow-sm justify-center"
                                  >
                                    <ArrowUpRight className="h-5 w-5 mr-1.5" />
                                    {artifact.label}
                                  </Button>
                                </a>
                              ))
                            ) : (
                              <p className="text-sm text-gray-500 italic">
                                No additional links available
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Divider */}
                      {activeTab === "overview" && (
                        <div className="border-t border-gray-200"></div>
                      )}

                      {/* Additional materials */}
                      {activeTab === "overview" && (
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-black tracking-tight mb-4">
                            Additional materials
                          </h3>
                          <div className="space-y-2">
                            {project.additional_materials_url ? (
                              <a
                                href={project.additional_materials_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block"
                              >
                                <Button
                                  variant="secondary"
                                  className="w-full bg-black/5 hover:bg-black/10 rounded-xl py-2.5 shadow-sm justify-center"
                                >
                                  <ArrowUpRight className="h-5 w-5 mr-1.5" />
                                  Pitch deck
                                </Button>
                              </a>
                            ) : canEdit ? (
                              <p className="text-sm text-gray-500 italic">
                                No additional materials added yet. Add them in the
                                settings below.
                              </p>
                            ) : (
                              <p className="text-sm text-gray-500 italic">
                                No additional materials available
                              </p>
                            )}
                            {extraMaterialLinks.map((artifact, index) => (
                              <a
                                key={`${artifact.id || artifact.url}-material-${index}`}
                                href={artifact.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block"
                              >
                                <Button
                                  variant="secondary"
                                  className="w-full bg-black/5 hover:bg-black/10 rounded-xl py-2.5 shadow-sm justify-center"
                                >
                                  <ArrowUpRight className="h-5 w-5 mr-1.5" />
                                  {artifact.label}
                                </Button>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Divider */}
                      {activeTab === "overview" && (
                        <div className="border-t border-gray-200"></div>
                      )}

                      {/* Share this project */}
                      {activeTab === "overview" && (
                        <ProjectShareSection
                          projectId={project.id}
                          projectName={project.project_name}
                          eventName={eventDetails?.event_name}
                          teamNames={teamMembers.map((m) => m.displayName)}
                          videoUrl={project.video_url}
                          showCertificateLink={!!project.submitted}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Tabs>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the
                project
                <strong> &quot;{project?.project_name}&quot;</strong> and all
                associated data including:
                <br />
                <br />
                • Project details and description
                <br />
                • Team member assignments
                <br />
                • Track selections
                <br />
                • All feedback received
                <br />• Uploaded materials
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isUpdating}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteProject}
                disabled={isUpdating}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isUpdating ? "Deleting..." : "Delete Project"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Give Feedback Dialog */}
        {project && (
          <GiveFeedbackDialog
            open={showFeedbackDialog}
            onOpenChange={setShowFeedbackDialog}
            projectName={project.project_name}
            projectId={project.id}
            eventId={project.event_id || ""}
          />
        )}
      </PageContent>
    </PageContainer>
  );
}
