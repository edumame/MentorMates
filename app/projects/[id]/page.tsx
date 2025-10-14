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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Users,
  Calendar,
  QrCode,
  Copy,
  ExternalLink,
  Trash2,
  Plus,
  X,
  UserPlus,
  Check,
  ChevronsUpDown,
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
import { ProjectQRCodeSection } from "@/features/projects/components/displays/project-dashboard/ProjectQRCodeSection";
import { FileUpload } from "@/components/db/fileUpload";
import { ImageUpload } from "@/components/db/imageUpload";
import { VideoEmbed, canEmbed } from "@/components/utils";
import { createContextusProject } from "@/lib/integrations/contextus";
import { useAdmin } from "@/lib/hooks/use-admin";
import { useProjectLike } from "@/features/projects/hooks/use-project-like";

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

  // Team management state
  const [newTeammateEmail, setNewTeammateEmail] = useState("");
  const [isAddingTeammate, setIsAddingTeammate] = useState(false);

  // Participant search state
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  // Event details state
  const [eventDetails, setEventDetails] = useState<EventDetails | null>(null);

  // Contextus ID state
  const [showContextusId, setShowContextusId] = useState(false);

  // Active tab state
  const [activeTab, setActiveTab] = useState("overview");

  // Give Feedback Dialog state
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);

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
          .select("event_id, event_name, slug, event_date, location, cover_image_url")
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

  const fetchProject = async () => {
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

  const handleAddTeammate = async (email?: string) => {
    const emailToAdd = email || newTeammateEmail.trim();

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

    setIsAddingTeammate(true);
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
      setNewTeammateEmail("");
      setSearchValue("");
      setSearchOpen(false);
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
    } finally {
      setIsAddingTeammate(false);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading project...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Project not found</h1>
          <Link href="/projects">
            <Button>Back to Projects</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isLead = session?.user?.email === project.lead_email;
  const totalMembers = (project.teammates?.length || 0) + 1;
  const feedbackUrl = `${
    typeof window !== "undefined" ? window.location.origin : ""
  }/projects/public/${project.id}`;

  return (
    <div className="bg-white min-h-screen">
      <Toaster />

      {/* Header Section */}
      <div className="bg-gradient-to-b from-blue-50/45 to-white border-b border-gray-200">
        <div className="container mx-auto px-8 pt-8 pb-0">
          {/* Top Actions Bar */}
          <div className="flex items-center justify-between mb-6">
            {/* Metadata Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="secondary"
                className="bg-white border border-black/15 text-black px-3 py-1.5 rounded-full flex items-center gap-1"
              >
                <Loader className="h-4 w-4" />
                {project.submitted ? "Submitted" : "Draft"}
              </Badge>
              <Badge
                variant="secondary"
                className="bg-white border border-black/15 text-black px-3 py-1.5 rounded-full flex items-center gap-1"
              >
                <Calendar className="h-4 w-4" />
                Created: {new Date(project.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </Badge>
              <Badge
                variant="secondary"
                className="bg-white border border-black/15 text-black px-3 py-1.5 rounded-full flex items-center gap-1"
              >
                <Users className="h-4 w-4" />
                {totalMembers} members
              </Badge>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              {canEdit && (
                <Button
                  variant="ghost"
                  className="rounded-xl px-5 py-2"
                  onClick={() => router.push(`/projects/${projectId}/edit`)}
                >
                  <Edit className="h-5 w-5 mr-1.5" />
                  Edit
                </Button>
              )}
              <Button
                variant="secondary"
                aria-pressed={liked}
                disabled={likeIsLoading}
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
                className={`rounded-xl px-5 py-2 shadow-sm ${
                  liked
                    ? "bg-red-100 text-red-700 hover:bg-red-200"
                    : "bg-black/5 hover:bg-black/10"
                }`}
              >
                {likeIsLoading ? (
                  <Loader className="h-5 w-5 mr-1.5" />
                ) : (
                  <Heart
                    className="h-5 w-5 mr-1.5"
                    fill={liked ? "currentColor" : "none"}
                  />
                )}
                {liked ? "Liked" : "Like"}
                <span className="ml-2 text-sm">{likesCount}</span>
              </Button>
              <Button
                onClick={() => setShowFeedbackDialog(true)}
                className="bg-[#4b89ef] hover:bg-[#3d75d9] text-white rounded-xl px-5 py-2 shadow-sm"
              >
                Give feedback
              </Button>
            </div>
          </div>

          {/* Project Title and Hero Section */}
          <div className="flex gap-20 mb-12">
            {/* Left: Title and Description */}
            <div className="flex-1 space-y-8">
              <div className="space-y-6">
                {canEdit ? (
                  <EditableField
                    value={project.project_name}
                    onSave={handleUpdateTitle}
                    canEdit={canEdit}
                    isLoading={isUpdating}
                    displayClassName="text-3xl font-semibold text-black tracking-tight leading-9"
                    inputClassName="text-3xl font-semibold text-black tracking-tight leading-9"
                    renderDisplay={(value) => (
                      <h1 className="text-3xl font-semibold text-black tracking-tight leading-9 hover:text-blue-600">
                        {value}
                      </h1>
                    )}
                  />
                ) : (
                  <h1 className="text-3xl font-semibold text-black tracking-tight leading-9">
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
            <div className="w-[520px] h-[300px] rounded-2xl overflow-hidden shadow-lg">
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
                    <span className="text-white text-sm">Click to edit in settings below</span>
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

          {/* Tabs Navigation */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-transparent border-b border-gray-200 rounded-none h-auto p-0 w-full justify-start gap-6">
              <TabsTrigger
                value="overview"
                className="data-[state=active]:border-b-2 data-[state=active]:border-[#4b89ef] rounded-none bg-transparent pb-2 font-medium"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="tracks"
                className="data-[state=active]:border-b-2 data-[state=active]:border-[#4b89ef] rounded-none bg-transparent pb-2"
              >
                Tracks
              </TabsTrigger>
              <TabsTrigger
                value="team"
                className="data-[state=active]:border-b-2 data-[state=active]:border-[#4b89ef] rounded-none bg-transparent pb-2 flex items-center gap-2"
              >
                Team
                <Badge variant="secondary" className="bg-white border border-black/15 text-black rounded-full text-xs">
                  {totalMembers}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="feedback"
                className="data-[state=active]:border-b-2 data-[state=active]:border-[#4b89ef] rounded-none bg-transparent pb-2 flex items-center gap-2"
              >
                Feedback
                <Badge variant="secondary" className="bg-white border border-black/15 text-black rounded-full text-xs">
                  0
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="sharing"
                className="data-[state=active]:border-b-2 data-[state=active]:border-[#4b89ef] rounded-none bg-transparent pb-2"
              >
                Sharing
              </TabsTrigger>
            </TabsList>

            {/* Main Content Area */}
            <div className="py-12">
              <div className="flex gap-10">
                {/* Left Column: Main Content */}
                <div className="flex-1 space-y-12">
                  <TabsContent value="overview" className="mt-0">
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
                          <div className="flex gap-2 items-start">
                            <div className="w-0.5 bg-black/15 flex-shrink-0"></div>
                            <p className="text-sm text-black">Image caption goes here</p>
                          </div>
                        </div>
                      )}

                      {/* Video Embed */}
                      {project.video_url && canEmbed(project.video_url) && (
                        <div className="space-y-4">
                          <VideoEmbed url={project.video_url} title="Project Video" />
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
                                          <span className="text-blue-600 hover:text-blue-800 cursor-pointer">
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
                                      value={project.additional_materials_url || ""}
                                      onSave={handleUpdateAdditionalMaterials}
                                      canEdit={canEdit}
                                      isLoading={isUpdating}
                                      placeholder="https://github.com/your-repo or https://docs.google.com/..."
                                      displayClassName="text-blue-600 underline"
                                      renderDisplay={(value) =>
                                        value ? (
                                          <span className="text-blue-600 hover:text-blue-800 cursor-pointer">
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
                                handleUpload={handleAdditionalMaterialsFileUpload}
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
                                        <span className="text-blue-600 hover:text-blue-800 cursor-pointer">
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
                                        <span className="text-blue-600 hover:text-blue-800 cursor-pointer">
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

                  <TabsContent value="tracks" className="mt-0">
                    <TrackSelector
                      projectId={project.id}
                      eventId={project.event_id}
                      canEdit={canEdit}
                      isLoading={isUpdating}
                    />
                  </TabsContent>

                  <TabsContent value="team" className="mt-0">
                    <Card>
                      <CardHeader>
                        <CardTitle>Team Members</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 border rounded">
                            <div>
                              <p className="font-medium">{project.lead_name}</p>
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
                                <p className="text-sm text-gray-500">Team Member</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">Member</Badge>
                                {canEdit && isLead && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveTeammate(teammate)}
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

                            <div className="space-y-3">
                              <div>
                                <label className="text-xs font-medium text-gray-600 mb-1 block">
                                  Search Event Participants:
                                </label>
                                <div className="flex gap-2">
                                  <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={searchOpen}
                                        className="flex-1 justify-between text-left font-normal"
                                        disabled={isAddingTeammate}
                                      >
                                        {searchValue
                                          ? participants.find(
                                              (participant) =>
                                                participant.email === searchValue
                                            )?.display_name || searchValue
                                          : "Search participants..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="p-0" align="start">
                                      <Command>
                                        <CommandInput
                                          placeholder="Search participants..."
                                          disabled={isLoadingParticipants}
                                        />
                                        <CommandList>
                                          <CommandEmpty>
                                            {isLoadingParticipants
                                              ? "Loading..."
                                              : "No participants found."}
                                          </CommandEmpty>
                                          <CommandGroup>
                                            {participants.map((participant) => {
                                              const isAlreadyTeammate = [
                                                project?.lead_email?.toLowerCase(),
                                                ...(project?.teammates || []).map((t) =>
                                                  t.toLowerCase()
                                                ),
                                              ].includes(participant.email.toLowerCase());

                                              return (
                                                <CommandItem
                                                  key={participant.user_id}
                                                  value={participant.email}
                                                  onSelect={(currentValue: string) => {
                                                    if (!isAlreadyTeammate) {
                                                      setSearchValue(currentValue);
                                                      setSearchOpen(false);
                                                      handleAddTeammate(currentValue);
                                                    }
                                                  }}
                                                  disabled={isAlreadyTeammate}
                                                >
                                                  <div className="flex flex-col flex-1">
                                                    <span className="font-medium">
                                                      {participant.display_name ||
                                                        participant.email}
                                                    </span>
                                                    <span className="text-sm text-gray-500">
                                                      {participant.email}
                                                    </span>
                                                  </div>
                                                  {isAlreadyTeammate && (
                                                    <Badge
                                                      variant="secondary"
                                                      className="ml-2"
                                                    >
                                                      Team Member
                                                    </Badge>
                                                  )}
                                                  {searchValue === participant.email && (
                                                    <Check className="ml-2 h-4 w-4" />
                                                  )}
                                                </CommandItem>
                                              );
                                            })}
                                          </CommandGroup>
                                        </CommandList>
                                      </Command>
                                    </PopoverContent>
                                  </Popover>
                                </div>
                              </div>

                              <div>
                                <label className="text-xs font-medium text-gray-600 mb-1 block">
                                  Or enter email manually:
                                </label>
                                <div className="flex gap-2">
                                  <Input
                                    type="email"
                                    placeholder="Enter team member's email"
                                    value={newTeammateEmail}
                                    onChange={(e) => setNewTeammateEmail(e.target.value)}
                                    disabled={isAddingTeammate}
                                    className="flex-1"
                                  />
                                  <Button
                                    onClick={() => handleAddTeammate()}
                                    disabled={
                                      isAddingTeammate || !newTeammateEmail.trim()
                                    }
                                  >
                                    {isAddingTeammate ? (
                                      "Adding..."
                                    ) : (
                                      <>
                                        <Plus className="h-4 w-4 mr-1" />
                                        Add
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>

                            <p className="text-xs text-gray-500 mt-3">
                              Team members will be able to edit this project and receive
                              notifications.
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="feedback" className="mt-0">
                    <Card>
                      <CardHeader>
                        <CardTitle>Project Feedback</CardTitle>
                        <p className="text-sm text-gray-600">
                          View feedback received for this project. Share the public link
                          below for others to provide feedback.
                        </p>
                      </CardHeader>
                      <CardContent>
                        <div className="mb-6">
                          <div className="flex items-center gap-2 mb-2">
                            <label className="text-sm font-medium text-gray-700">
                              Public Feedback URL:
                            </label>
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={feedbackUrl}
                              readOnly
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(feedbackUrl);
                                toast({
                                  title: "Copied!",
                                  description: "Feedback URL copied to clipboard",
                                });
                              }}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <FeedbackDisplay projectId={project.id} showTitle={false} />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Sharing Tab */}
                  <TabsContent value="sharing" className="mt-0">
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr,500px] gap-6">
                      {/* Left Column: Share Card */}
                      <Card className="border border-zinc-200">
                        <CardHeader>
                          <CardTitle className="text-[22px] font-semibold tracking-[-0.06em]">
                            Share & Get Feedback
                          </CardTitle>
                          <p className="text-sm text-zinc-500">
                            Share this project with others using the QR code or direct link.
                          </p>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          {/* Copy Link Section */}
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <Input
                                value={feedbackUrl}
                                readOnly
                                className="flex-1 bg-white"
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
                      </Card>

                      {/* Right Column: Sharing Tips */}
                      <div className="bg-gradient-to-b from-blue-100/45 to-blue-50/30 rounded-lg p-6 space-y-6">
                        <div className="bg-white rounded-[13px] p-1.5 w-fit">
                          <Lightbulb className="h-6 w-6" />
                        </div>

                        <div className="text-center">
                          <p className="font-medium text-base text-black">Sharing Tips</p>
                        </div>

                        <div className="space-y-3">
                          <div className="py-3 space-y-1">
                            <p className="text-[24px] font-['Poly'] text-zinc-900">01</p>
                            <p className="text-sm text-zinc-500 leading-[22px]">
                              Save the QR code image to share digitally
                            </p>
                          </div>

                          <div className="border-t border-gray-200" />

                          <div className="py-3 space-y-1">
                            <p className="text-[24px] font-['Poly'] text-zinc-900">02</p>
                            <p className="text-sm text-zinc-500 leading-[22px]">
                              Print it on business cards or project handouts
                            </p>
                          </div>

                          <div className="border-t border-gray-200" />

                          <div className="py-3 space-y-1">
                            <p className="text-[24px] font-['Poly'] text-zinc-900">03</p>
                            <p className="text-sm text-zinc-500 leading-[22px]">
                              Display it at your project booth or presentation
                            </p>
                          </div>

                          <div className="border-t border-gray-200" />

                          <div className="py-3 space-y-1">
                            <p className="text-[24px] font-['Poly'] text-zinc-900">04</p>
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
                {activeTab !== "sharing" && (
                <div className="w-[420px] space-y-6">
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
                      {project.teammates?.slice(0, 1).map((teammate, index) => (
                        <div key={index} className="flex gap-4 items-center">
                          <div className="w-14 h-14 rounded-full bg-gray-300 flex-shrink-0"></div>
                          <div className="space-y-0">
                            <p className="font-semibold text-base text-black">
                              {teammate}
                            </p>
                            <p className="text-base text-black">Student, Stanford</p>
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
                      <Card className="border border-black/15 rounded-xl overflow-hidden">
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
                                {new Date(eventDetails.start_date).toLocaleDateString("en-US", { weekday: "short" })}
                              </p>
                              <p className="text-4xl font-semibold text-black tracking-tight leading-none">
                                {new Date(eventDetails.start_date).getDate()}
                              </p>
                              <p className="text-sm text-black">
                                {new Date(eventDetails.start_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
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
                            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros.
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Divider */}
                  {activeTab === "overview" && (
                  <div className="border-t border-gray-200"></div>
                  )}

                  {/* Additional materials */}
                  {activeTab === "overview" && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-black tracking-tight">
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
                        No additional materials added yet. Add them in the settings below.
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
                            description: "Project link copied to clipboard",
                          });
                        }}
                      >
                        <LinkIcon className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-lg"
                        onClick={handleCopyQR}
                      >
                        <QrCode className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="bg-white rounded-full"
                      >
                        <Share2 className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="bg-white rounded-full"
                      >
                        <Share2 className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="bg-white rounded-full"
                      >
                        <Share2 className="h-5 w-5" />
                      </Button>
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
            <AlertDialogCancel disabled={isUpdating}>Cancel</AlertDialogCancel>
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
    </div>
  );
}
