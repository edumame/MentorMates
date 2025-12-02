"use client";

import { useEffect, useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Users,
  Calendar,
  QrCode,
  Copy,
  ExternalLink,
  Trash2,
  X,
  UserPlus,
  Edit,
  Heart,
  Loader,
  MapPin,
  ArrowUpRight,
  Link as LinkIcon,
  Video,
  Share2,
  Lightbulb,
  Download,
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
import FeedbackDisplay from "@/features/projects/components/feedback/FeedbackDisplay";
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
import { fetchEventTracks } from "@/features/projects/client-actions/client-track-update";
import { ProjectQRCodeSection } from "@/features/projects/components/displays/project-dashboard/ProjectQRCodeSection";
import { FileUpload } from "@/components/db/fileUpload";
import { ImageUpload } from "@/components/db/imageUpload";
import { VideoEmbed, canEmbed } from "@/components/utils";
import { createContextusProject } from "@/lib/integrations/contextus";
import { useAdmin } from "@/lib/hooks/use-admin";
import { useProjectLike } from "@/features/projects/hooks/use-project-like";
import { PageContainer, PageContent } from "@/components/layout/PageContainer";
import UserSearchWithInvite from "@/components/utils/UserSearchWithInvite";
import { EditNote, Favorite } from "@mui/icons-material";

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
  event_type?: string;
  cover_image_url?: string;
}

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const isAdmin = useAdmin();
  const [session, setSession] = useState<Session | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Loading state for updates
  const [isUpdating, setIsUpdating] = useState(false);
  const [hasEventTracks, setHasEventTracks] = useState(true);

  // Participant search state
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);

  // Event details state
  const [eventDetails, setEventDetails] = useState<EventDetails | null>(null);

  // Contextus ID state
  const [showContextusId, setShowContextusId] = useState(false);

  // Active tab state
  const [activeTab, setActiveTab] = useState("overview");

  // Give Feedback Dialog state
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);

  const [fetchComplete, setFetchComplete] = useState(false);

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
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);
      setIsLoading(false);
    };

    getSession();
  }, []);

  useEffect(() => {
    if (session?.user?.email) {
      fetchProject();
    }
  }, [session, projectId]);

  // Fetch event details when project is loaded
  useEffect(() => {
    const fetchEventDetails = async () => {
      if (!project?.event_id) return;

      try {
        const { data: eventData, error } = await supabase
          .from("events")
          .select(
            "event_id, event_name, slug, event_date, location, cover_image_url"
          )
          .eq("event_id", project.event_id)
          .single();

        if (error) {
          return;
        }

        if (eventData) {
          setEventDetails({
            event_id: eventData.event_id,
            event_name: eventData.event_name,
            slug: eventData.slug || "",
            start_date: eventData.event_date,
            end_date: eventData.event_date,
            location: eventData.location || undefined,
            event_type: undefined,
            cover_image_url: eventData.cover_image_url || undefined,
          });
        }
      } catch (error) {
        // Silently fail if event details cannot be fetched
      }
    };

    fetchEventDetails();
  }, [project?.event_id]);

  useEffect(() => {
    let isMounted = true;

    const checkEventTracks = async () => {
      if (!project?.event_id) {
        return;
      }

      try {
        const { data, error } = await fetchEventTracks(project.event_id);
        if (!isMounted) {
          return;
        }

        if (error) {
          console.error("Error checking event tracks:", error);
          return;
        }

        setHasEventTracks(Boolean(data?.length));
      } catch (error) {
        if (isMounted) {
          console.error("Error determining event tracks:", error);
        }
      }
    };

    void checkEventTracks();

    return () => {
      isMounted = false;
    };
  }, [project?.event_id]);

  useEffect(() => {
    if (!hasEventTracks && activeTab === "tracks") {
      setActiveTab("overview");
    }
  }, [hasEventTracks, activeTab]);

  const fetchProject = async () => {
    setIsLoading(true);
    setFetchComplete(false);
    
    const { data, error } = await supabase
      .from("projects")
      .select(
        `
        *,
        contextus_project_id
      `
      )
      .eq("id", projectId)
      .single();

    if (error) {
      return;
    }

    setProject(data);

    // Check if user can edit (is lead or teammate)
    if (session?.user?.email) {
      const userEmail = session.user.email;
      const isLead = data.lead_email === userEmail;
      const isTeammate = data.teammates?.includes(userEmail);
      const canEditProject = isLead || isTeammate;
      setCanEdit(canEditProject);
    }
    
    setIsLoading(false);
    setFetchComplete(true);
  };

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

      setProject(data);
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

      setProject(data);
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

      setProject(data);
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

      setProject(data);
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

      setProject(data);
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

      const { data, error } = await updateProjectClient(projectId, {
        additional_materials_url: newUrl.trim() || undefined,
      });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update additional materials URL",
          variant: "destructive",
        });
        return false;
      }

      setProject(data);
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

      setProject(data);
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

      const { data, error } = await updateProjectClient(projectId, {
        additional_materials_url: publicUrl,
      });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update additional materials URL",
          variant: "destructive",
        });
        return false;
      }

      setProject(data);
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
      const { data, error } = await supabase
        .from("user_event_roles")
        .select(
          `
          user_id,
          profiles:user_id (
            display_name,
            email
          )
        `
        )
        .eq("event_id", project.event_id)
        .overrideTypes<
          Array<{
            user_id: string;
            profiles: {
              display_name: string | null;
              email: string | null;
            };
          }>
        >();

      if (error) {
        return;
      }

      const participantList: EventParticipant[] = (data || [])
        .filter((role) => role.profiles?.email)
        .map((role) => ({
          user_id: role.user_id,
          display_name:
            role.profiles?.display_name || role.profiles?.email || "",
          email: role.profiles?.email || "",
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

      setProject(data);
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

      setProject(data);
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

      setProject(data);
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

  if (isLoading || !fetchComplete) {
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

  if (!project) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center flex-grow">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Project not found</h1>
            <Link href="/projects">
              <Button>Back to Projects</Button>
            </Link>
          </div>
        </div>
      </PageContainer>
    );
  }

  const isLead = session?.user?.email === project.lead_email;
  const totalMembers = (project.teammates?.length || 0) + 1;
  const feedbackUrl = `${
    typeof window !== "undefined" ? window.location.origin : ""
  }/projects/public/${project.id}`;

  const handleShare = (platform: string) => {
    switch (platform) {
      case "copy":
        navigator.clipboard.writeText(feedbackUrl);
        alert("Link copied to clipboard!");
        break;
      case "linkedin":
        window.open(
          `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(feedbackUrl)}`,
          "_blank"
        );
        break;
      case "facebook":
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(feedbackUrl)}`,
          "_blank"
        );
        break;
      case "twitter":
        window.open(
          `https://twitter.com/intent/tweet?url=${encodeURIComponent(feedbackUrl)}`,
          "_blank"
        );
        break;
    }
  };

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
              <div className="flex items-center gap-2 flex-wrap">
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
                    {new Date(project.created_at).toLocaleDateString("en-US", {
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
              <div className="hidden sm:flex items-center gap-3">
                {canEdit && (
                  <Button
                    variant="ghost"
                    className="rounded-xl px-5 py-2 text-base"
                    onClick={() => router.push(`/projects/${projectId}/edit`)}
                  >
                    {/* <Edit className="h-6 w-6 mr-1.5" /> */}
                    <EditNote className="h-6 w-6 mr-1.5" />
                    Edit
                  </Button>
                )}
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
                  className={`cursor-pointer rounded-xl px-5 py-2 text-base flex items-center`}
                >
                  {likeIsLoading ? (
                    <Loader className="h-6 w-6 mr-1.5" />
                  ) : (
                    <>
                      {liked ? (
                        <Favorite
                          className="h-6 w-6 mr-1.5"
                          style={{ fill: "#4B89EF" }}
                        />
                      ) : (
                        <Heart className="h-6 w-6 mr-1.5" fill="none" />
                      )}
                    </>
                  )}
                  {liked ? "Liked" : "Like"}
                  {/* <span className="ml-2 text-sm">{likesCount}</span> */}
                </div>
                <Button
                  onClick={() => setShowFeedbackDialog(true)}
                  className="bg-[#4b89ef] hover:bg-[#3d75d9] text-white rounded-xl px-5 py-2 shadow-sm text-base whitespace-nowrap"
                >
                  Give feedback
                </Button>
              </div>
            </div>

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
                      displayClassName="text-lg text-gray-700 leading-relaxed"
                      renderDisplay={(value) => (
                        <p className="text-lg text-gray-700 leading-relaxed hover:text-blue-600">
                          {value}
                        </p>
                      )}
                    />
                  ) : (
                    <p className="text-lg text-gray-700 leading-relaxed">
                      {project.project_description}
                    </p>
                  )}
                </div>

                {/* Action Buttons for Project */}
                <div className="flex gap-3">
                  {project.project_url && (
                    <a
                      href={project.project_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button className="bg-[#4b89ef] hover:bg-[#3d75d9] text-white rounded-xl px-6 py-2.5 shadow-sm">
                        <ArrowUpRight className="h-5 w-5 mr-1.5" />
                        View Live Project
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
                        className="bg-black/5 hover:bg-black/10 rounded-xl px-6 py-2.5 shadow-sm"
                      >
                        <Video className="h-5 w-5 mr-1.5" />
                        Watch Video
                      </Button>
                    </a>
                  )}
                </div>
              </div>

              {/* Right: Cover Image */}
              <div className="w-full lg:w-[520px] h-[200px] sm:h-[250px] lg:h-[300px] rounded-2xl overflow-hidden shadow-lg order-2">
                {canEdit ? (
                  <div className="relative w-full h-full group">
                    <div
                      className="w-full h-full bg-cover bg-center bg-no-repeat"
                      style={{
                        backgroundImage: `url(${
                          project.cover_image_url || "/img/placeholder.png"
                        })`,
                      }}
                    ></div>
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-sm">
                        Click to edit in settings below
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    className="w-full h-full bg-cover bg-center bg-no-repeat"
                    style={{
                      backgroundImage: `url(${
                        project.cover_image_url || "/img/placeholder.png"
                      })`,
                    }}
                  ></div>
                )}
              </div>
            </div>

            {/* Action Buttons - Mobile Only */}
            <div className="flex sm:hidden items-center gap-2 mb-6 overflow-x-auto">
              {canEdit && (
                <Button
                  variant="ghost"
                  className="rounded-xl px-5 py-2 text-base"
                  onClick={() => router.push(`/projects/${projectId}/edit`)}
                >
                  <Edit className="h-6 w-6 mr-1.5" />
                  Edit
                </Button>
              )}
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
                className={`cursor-pointer rounded-xl px-5 py-2 text-base flex items-center`}
              >
                {likeIsLoading ? (
                  <Loader className="h-6 w-6" />
                ) : (
                  <>
                    {liked ? (
                      <Favorite
                        className="h-6 w-6 mr-1.5"
                        style={{ fill: "#4B89EF" }}
                      />
                    ) : (
                      <Heart className="h-6 w-6 mr-1.5" fill="none" />
                    )}
                  </>
                )}
                {liked ? "Liked" : "Like"}
              </div>
              <Button
                onClick={() => setShowFeedbackDialog(true)}
                className="bg-[#4b89ef] hover:bg-[#3d75d9] text-white rounded-xl px-5 py-2 shadow-sm text-base whitespace-nowrap"
              >
                Give feedback
              </Button>
            </div>

            {/* Tabs Navigation */}
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="bg-transparent border-b border-gray-200 rounded-none h-auto p-0 w-full justify-start gap-3 sm:gap-6 overflow-x-auto scrollbar-hide flex-nowrap">
                <TabsTrigger
                  value="overview"
                  className="text-base shadow-none data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#4b89ef] rounded-none bg-transparent pb-2 font-medium"
                >
                  Overview
                </TabsTrigger>
                {hasEventTracks && (
                  <TabsTrigger
                    value="tracks"
                    className="text-base shadow-none data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#4b89ef] rounded-none bg-transparent pb-2"
                  >
                    Tracks
                  </TabsTrigger>
                )}
                <TabsTrigger
                  value="team"
                  className="text-base shadow-none data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#4b89ef] rounded-none bg-transparent pb-2 flex items-center gap-2"
                >
                  Team
                  <Badge
                    variant="secondary"
                    className="bg-white border border-black/15 text-black rounded-full text-xs"
                  >
                    {totalMembers}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger
                  value="feedback"
                  className="text-base shadow-none data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#4b89ef] rounded-none bg-transparent pb-2 flex items-center gap-2"
                >
                  Feedback
                  <Badge
                    variant="secondary"
                    className="bg-white border border-black/15 text-black rounded-full text-xs"
                  >
                    0
                  </Badge>
                </TabsTrigger>
                <TabsTrigger
                  value="sharing"
                  className="text-base shadow-none data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#4b89ef] rounded-none bg-transparent pb-2"
                >
                  Sharing
                </TabsTrigger>
              </TabsList>

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
                              displayClassName="text-base text-black leading-relaxed"
                              renderDisplay={(value) => (
                                <p className="text-base text-black leading-relaxed hover:text-blue-600">
                                  {value}
                                </p>
                              )}
                            />
                          ) : (
                            <p className="text-base text-black leading-relaxed">
                              {project.project_description}
                            </p>
                          )}
                        </div>

                        {/* Cover Image Display */}
                        {project.cover_image_url && (
                          <div className="space-y-2">
                            <div className="rounded-xl overflow-hidden">
                              <img
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

                        {/* Settings Section - Only for editors */}
                        {canEdit && (
                          <Card className="mt-12">
                            <CardHeader>
                              <CardTitle>Project Settings</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                              {/* Cover Image URL */}
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
                                          ) : (
                                            <span className="text-gray-400 italic">
                                              No cover image URL set
                                            </span>
                                          )
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

                              {/* Additional Materials */}
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
                                          ) : (
                                            <span className="text-gray-400 italic">
                                              No additional materials URL set
                                            </span>
                                          )
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

                              {/* Project URL */}
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
                                        ) : (
                                          <span className="text-gray-400 italic">
                                            No project URL set
                                          </span>
                                        )
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
                              </div>

                              {/* Video URL */}
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
                                        ) : (
                                          <span className="text-gray-400 italic">
                                            No video URL set
                                          </span>
                                        )
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

                    <TabsContent value="team" className="mt-0 overflow-hidden">
                      <Card>
                        <CardHeader>
                          <CardTitle>Team Members</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 border rounded">
                              <div>
                                <p className="font-medium">
                                  {project.lead_name}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {project.lead_email}
                                </p>
                              </div>
                              <Badge>Lead</Badge>
                            </div>

                            {project.teammates?.map((teammate, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between p-3 border rounded"
                              >
                                <div>
                                  <p className="font-medium">{teammate}</p>
                                  <p className="text-sm text-gray-500">
                                    Team Member
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary">Member</Badge>
                                  {canEdit && isLead && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        handleRemoveTeammate(teammate)
                                      }
                                      disabled={isUpdating}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>

                          {canEdit && isLead && (
                            <div className="mt-6 pt-4 border-t">
                              <div className="flex items-center gap-2 mb-3">
                                <UserPlus className="h-4 w-4 text-gray-500" />
                                <h4 className="font-medium text-gray-900">
                                  Add Team Member
                                </h4>
                              </div>

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
                                  const participantEmails = participants.map(
                                    (p) => p.email.toLowerCase()
                                  );

                                  // Only process emails that are actual event participants
                                  const validEmails = emails.filter((email) =>
                                    participantEmails.includes(
                                      email.toLowerCase()
                                    )
                                  );

                                  // Find newly added emails (only from valid participants)
                                  const currentTeammates =
                                    project?.teammates || [];
                                  const newEmails = validEmails.filter(
                                    (email) =>
                                      !currentTeammates.some(
                                        (t) =>
                                          t.toLowerCase() ===
                                          email.toLowerCase()
                                      )
                                  );

                                  // Find removed emails
                                  const removedEmails = currentTeammates.filter(
                                    (email) =>
                                      !validEmails.some(
                                        (e) =>
                                          e.toLowerCase() ===
                                          email.toLowerCase()
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
                                initialTags={(project?.teammates || []).map(
                                  (email) => {
                                    const participant = participants.find(
                                      (p) =>
                                        p.email.toLowerCase() ===
                                        email.toLowerCase()
                                    );
                                    return participant
                                      ? `${participant.display_name || participant.email} (${participant.email})`
                                      : email;
                                  }
                                )}
                                projectId={projectId}
                                enableInvite={true}
                              />

                              <p className="text-xs text-gray-500 mt-3">
                                Search for event participants to add them
                                immediately, or send an invitation to users not
                                yet registered. Invited users will be added to
                                the team once they accept the invitation.
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent
                      value="feedback"
                      className="mt-0 overflow-hidden"
                    >
                      <div>
                        <FeedbackDisplay
                          projectId={project.id}
                          showTitle={false}
                        />
                      </div>
                    </TabsContent>

                    {/* Sharing Tab */}
                    <TabsContent
                      value="sharing"
                      className="mt-0 overflow-hidden"
                    >
                      <div className="grid grid-cols-1 lg:grid-cols-[1fr,500px] gap-6 border border-zinc-200 rounded-md">
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
                            {/* Copy Link Section */}
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <Input
                                  value={feedbackUrl}
                                  readOnly
                                  className="flex-1 bg-white min-w-0"
                                />
                                <Button
                                  variant="secondary"
                                  className="bg-zinc-100 hover:bg-zinc-200"
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
                              <div className="w-[206px] h-[201px] bg-white">
                                <QRCodeSVG
                                  id="project-qr-code"
                                  value={feedbackUrl}
                                  size={200}
                                  level="H"
                                  includeMargin={false}
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
                          className="p-6 space-y-6"
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
                    <div className="w-full lg:w-[420px] lg:flex-shrink-0 space-y-6">
                      {/* Meet the team */}
                      {activeTab === "overview" && (
                        <div className="space-y-6">
                          <h3 className="text-lg font-bold text-black tracking-tight">
                            Meet the team
                          </h3>
                          <div className="space-y-6">
                            {/* Project Lead */}
                            <div className="flex gap-4 items-center">
                              <div className="w-14 h-14 rounded-full bg-gray-300 flex-shrink-0"></div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-base text-black">
                                    {project.lead_name}
                                  </p>
                                  <Badge
                                    variant="secondary"
                                    className="bg-transparent border border-black/15 text-black rounded-full text-sm px-2.5 py-0.5"
                                  >
                                    Lead
                                  </Badge>
                                </div>
                                <p className="text-base text-black">
                                  {project.lead_email}
                                </p>
                              </div>
                            </div>

                            {/* Team Members */}
                            {project.teammates
                              ?.slice(0, 1)
                              .map((teammate, index) => (
                                <div
                                  key={index}
                                  className="flex gap-4 items-center"
                                >
                                  <div className="w-14 h-14 rounded-full bg-gray-300 flex-shrink-0"></div>
                                  <div className="space-y-0">
                                    <p className="font-semibold text-base text-black">
                                      {teammate}
                                    </p>
                                    <p className="text-base text-black">
                                      Student, Stanford
                                    </p>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Divider */}
                      {activeTab === "overview" && (
                        <div className="border-t border-gray-200"></div>
                      )}

                      {/* Submitted to Event */}
                      {activeTab === "overview" && eventDetails && (
                        <div className="space-y-4">
                          <h3 className="text-lg font-bold text-black tracking-tight">
                            Submitted to
                          </h3>
                          <Link
                            href={`/events/${eventDetails.event_id}/overview`}
                          >
                            <Card className="border border-black/15 rounded-xl overflow-hidden hover:shadow-lg">
                              <div className="relative">
                                {eventDetails.cover_image_url ? (
                                  <img
                                    src={eventDetails.cover_image_url}
                                    alt={eventDetails.event_name}
                                    className="w-full h-[180px] object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-[180px] bg-gradient-to-br from-orange-400 via-blue-500 to-purple-600"></div>
                                )}
                                {eventDetails.start_date && (
                                  <div className="absolute top-4 right-4 bg-white border border-gray-300 rounded-xl py-3 px-1 text-center w-28">
                                    <p className="text-sm text-black">
                                      {new Date(
                                        eventDetails.start_date
                                      ).toLocaleDateString("en-US", {
                                        weekday: "short",
                                      })}
                                    </p>
                                    <p className="text-4xl font-semibold text-black tracking-tight leading-none">
                                      {new Date(
                                        eventDetails.start_date
                                      ).getDate()}
                                    </p>
                                    <p className="text-sm text-black">
                                      {new Date(
                                        eventDetails.start_date
                                      ).toLocaleDateString("en-US", {
                                        month: "short",
                                        year: "numeric",
                                      })}
                                    </p>
                                  </div>
                                )}
                              </div>
                              <CardContent className="p-6 space-y-4">
                                <div className="flex gap-1 flex-wrap">
                                  <Badge
                                    variant="secondary"
                                    className="bg-transparent border border-black/15 text-black rounded-full font-semibold"
                                  >
                                    {eventDetails.event_type || "Hackathon"}
                                  </Badge>
                                  <Badge
                                    variant="secondary"
                                    className="bg-transparent border border-black/15 text-black rounded-full font-semibold"
                                  >
                                    Paid event
                                  </Badge>
                                </div>
                                <div className="space-y-2">
                                  <h4 className="text-2xl font-semibold text-black tracking-tight">
                                    {eventDetails.event_name}
                                  </h4>
                                  <div className="flex items-center gap-1 text-sm">
                                    <MapPin className="h-4 w-4 text-black" />
                                    <span className="text-black text-center">
                                      {eventDetails.location || "Online"}
                                    </span>
                                  </div>
                                </div>
                                <p className="text-base text-black leading-relaxed">
                                  Lorem ipsum dolor sit amet, consectetur
                                  adipiscing elit. Suspendisse varius enim in
                                  eros.
                                </p>
                              </CardContent>
                            </Card>
                          </Link>
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
                          {project.additional_materials_url ? (
                            <a
                              href={project.additional_materials_url}
                              target="_blank"
                              rel="noopener noreferrer"
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
                        </div>
                      )}

                      {/* Divider */}
                      {activeTab === "overview" && (
                        <div className="border-t border-gray-200"></div>
                      )}

                      {/* Share this project */}
                      {activeTab === "overview" && (
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-black tracking-tight">
                            Share this project
                          </h3>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="bg-white rounded-full"
                              onClick={() => {
                                navigator.clipboard.writeText(feedbackUrl);
                                toast({
                                  title: "Link copied!",
                                  description:
                                    "Project link copied to clipboard",
                                });
                              }}
                            >
                              <LinkIcon className="h-5 w-5" />
                            </Button>
                            {/* QR Code */}
                            <button className="flex flex-col items-center justify-center overflow-hidden p-1 rounded-lg">
                              <QrCode className="w-6 h-6 text-black" />
                            </button>

                            {/* LinkedIn */}
                            <button
                              onClick={() => handleShare("linkedin")}
                              className="bg-white flex flex-col items-center justify-center overflow-hidden p-1 rounded-full"
                            >
                              {/* <Linkedin className="w-6 h-6 text-black" /> */}
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                              >
                                <path
                                  fillRule="evenodd"
                                  clipRule="evenodd"
                                  d="M4.5 3.24219C3.67157 3.24219 3 3.91376 3 4.74219V19.7422C3 20.5706 3.67157 21.2422 4.5 21.2422H19.5C20.3284 21.2422 21 20.5706 21 19.7422V4.74219C21 3.91376 20.3284 3.24219 19.5 3.24219H4.5ZM8.52076 7.24491C8.52639 8.20116 7.81061 8.79038 6.96123 8.78616C6.16107 8.78194 5.46357 8.14491 5.46779 7.24632C5.47201 6.40116 6.13998 5.72194 7.00764 5.74163C7.88795 5.76132 8.52639 6.40679 8.52076 7.24491ZM12.2797 10.0039H9.75971H9.7583V18.5638H12.4217V18.3641C12.4217 17.9842 12.4214 17.6042 12.4211 17.2241C12.4203 16.2103 12.4194 15.1954 12.4246 14.1819C12.426 13.9358 12.4372 13.6799 12.5005 13.445C12.7381 12.5675 13.5271 12.0008 14.4074 12.1401C14.9727 12.2286 15.3467 12.5563 15.5042 13.0893C15.6013 13.4225 15.6449 13.7811 15.6491 14.1285C15.6605 15.1761 15.6589 16.2237 15.6573 17.2714C15.6567 17.6412 15.6561 18.0112 15.6561 18.381V18.5624H18.328V18.3571C18.328 17.9051 18.3278 17.4532 18.3275 17.0013C18.327 15.8718 18.3264 14.7423 18.3294 13.6124C18.3308 13.1019 18.276 12.5985 18.1508 12.1049C17.9638 11.3708 17.5771 10.7633 16.9485 10.3246C16.5027 10.0124 16.0133 9.81129 15.4663 9.78879C15.404 9.7862 15.3412 9.78281 15.2781 9.7794C14.9984 9.76428 14.7141 9.74892 14.4467 9.80285C13.6817 9.95613 13.0096 10.3063 12.5019 10.9236C12.4429 10.9944 12.3852 11.0663 12.2991 11.1736L12.2797 11.1979V10.0039ZM5.68164 18.5666H8.33242V10.0095H5.68164V18.5666Z"
                                  fill="black"
                                />
                              </svg>
                            </button>

                            {/* Twitter/X */}
                            <button
                              onClick={() => handleShare("twitter")}
                              className="bg-white flex flex-col items-center justify-center overflow-hidden p-1 rounded-full"
                            >
                              <svg
                                className="w-6 h-6"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                              >
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                              </svg>
                            </button>

                            {/* Facebook */}
                            <button
                              onClick={() => handleShare("facebook")}
                              className="bg-white flex flex-col items-center justify-center overflow-hidden p-1 rounded-full"
                            >
                              {/* <Facebook className="w-6 h-6 text-black" /> */}
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                              >
                                <path
                                  d="M22 12.3033C22 6.7467 17.5229 2.24219 12 2.24219C6.47715 2.24219 2 6.7467 2 12.3033C2 17.325 5.65684 21.4874 10.4375 22.2422V15.2116H7.89844V12.3033H10.4375V10.0867C10.4375 7.56515 11.9305 6.17231 14.2146 6.17231C15.3088 6.17231 16.4531 6.36882 16.4531 6.36882V8.8448H15.1922C13.95 8.8448 13.5625 9.62041 13.5625 10.4161V12.3033H16.3359L15.8926 15.2116H13.5625V22.2422C18.3432 21.4874 22 17.3252 22 12.3033Z"
                                  fill="black"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
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
            projectDescription={project.project_description || ""}
            eventId={project.event_id || ""}
          />
        )}
      </PageContent>
    </PageContainer>
  );
}
