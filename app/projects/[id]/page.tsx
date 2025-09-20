"use client";

import { useEffect, useState, useCallback } from "react";
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
  MessageSquare,
  Calendar,
  ArrowLeft,
  QrCode,
  Copy,
  Tag,
  ExternalLink,
  Trash2,
  Plus,
  X,
  UserPlus,
  Check,
  ChevronsUpDown,
  Eye,
  EyeOff,
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

interface EventParticipant {
  user_id: string;
  display_name: string;
  email: string;
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
  const [eventName, setEventName] = useState<string>("");
  const [eventSlug, setEventSlug] = useState<string>("");

  // Contextus ID state
  const [showContextusId, setShowContextusId] = useState(false);

  // QR Code functionality
  const { handleCopyQR, handleDownloadQR } = useQRCodeActions(
    project?.event_id || "",
    projectId,
    project?.project_name
  );

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, projectId]);

  // Fetch event details when project is loaded
  useEffect(() => {
    const fetchEventDetails = async () => {
      if (!project?.event_id) return;

      try {
        const { data: eventData, error } = await supabase
          .from("events")
          .select("event_name, slug")
          .eq("event_id", project.event_id)
          .single();

        if (error) {
          console.error("Error fetching event details:", error);
        } else {
          setEventName(eventData?.event_name || "");
          setEventSlug(eventData?.slug || project.event_id);
        }
      } catch (error) {
        console.error("Error fetching event details:", error);
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
      console.error("Error fetching project:", error);
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

  // Option 1: Direct Supabase client (current approach)
  const handleUpdateTitle = async (newTitle: string): Promise<boolean> => {
    setIsUpdating(true);
    try {
      const { data, error } = await updateProjectClient(projectId, {
        project_name: newTitle,
      });

      if (error) {
        console.error("Error updating title:", error);
        toast({
          title: "Error",
          description: "Failed to update project title",
          variant: "destructive",
        });
        return false;
      }

      // Update local state
      setProject(data);
      toast({
        title: "Success",
        description: "Project title updated successfully",
      });
      return true;
    } catch (error) {
      console.error("Error updating title:", error);
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
        console.error("Error updating description:", error);
        toast({
          title: "Error",
          description: "Failed to update project description",
          variant: "destructive",
        });
        return false;
      }

      // Update local state
      setProject(data);
      toast({
        title: "Success",
        description: "Project description updated successfully",
      });
      return true;
    } catch (error) {
      console.error("Error updating description:", error);
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
      // Basic URL validation
      if (newUrl.trim() !== "") {
        try {
          // This will throw if the URL is invalid
          new URL(newUrl);

          // Check if URL starts with http:// or https://
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
        console.error("Error updating project URL:", error);
        toast({
          title: "Error",
          description: "Failed to update project URL",
          variant: "destructive",
        });
        return false;
      }

      // Update local state
      setProject(data);
      toast({
        title: "Success",
        description: newUrl.trim()
          ? "Project URL updated successfully"
          : "Project URL cleared successfully",
      });
      return true;
    } catch (error) {
      console.error("Error updating project URL:", error);
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
      // Basic URL validation
      if (newUrl.trim() !== "") {
        try {
          // This will throw if the URL is invalid
          new URL(newUrl);

          // Check if URL starts with http:// or https://
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
        console.error("Error updating cover image:", error);
        toast({
          title: "Error",
          description: "Failed to update cover image",
          variant: "destructive",
        });
        return false;
      }

      // Update local state
      setProject(data);
      toast({
        title: "Success",
        description: newUrl.trim()
          ? "Cover image updated successfully"
          : "Cover image cleared successfully",
      });
      return true;
    } catch (error) {
      console.error("Error updating cover image:", error);
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
      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `project-covers/${fileName}`;

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from("project-materials")
        .upload(filePath, file);

      if (uploadError) {
        console.error("Error uploading cover image:", uploadError);
        toast({
          title: "Upload Error",
          description: "Failed to upload image file",
          variant: "destructive",
        });
        return false;
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("project-materials").getPublicUrl(filePath);

      // Update project with new URL
      const { data, error } = await updateProjectClient(projectId, {
        cover_image_url: publicUrl,
      });

      if (error) {
        console.error("Error updating cover image:", error);
        toast({
          title: "Error",
          description: "Failed to update cover image",
          variant: "destructive",
        });
        return false;
      }

      // Update local state
      setProject(data);
      toast({
        title: "Success",
        description: "Cover image uploaded and updated successfully",
      });
      return true;
    } catch (error) {
      console.error("Error uploading cover image:", error);
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
      // Basic URL validation
      if (newUrl.trim() !== "") {
        try {
          // This will throw if the URL is invalid
          new URL(newUrl);

          // Check if URL starts with http:// or https://
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
        console.error("Error updating additional materials URL:", error);
        toast({
          title: "Error",
          description: "Failed to update additional materials URL",
          variant: "destructive",
        });
        return false;
      }

      // Update local state
      setProject(data);
      toast({
        title: "Success",
        description: newUrl.trim()
          ? "Additional materials URL updated successfully"
          : "Additional materials URL cleared successfully",
      });
      return true;
    } catch (error) {
      console.error("Error updating additional materials URL:", error);
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
      // Basic URL validation
      if (newUrl.trim() !== "") {
        try {
          // This will throw if the URL is invalid
          new URL(newUrl);

          // Check if URL starts with http:// or https://
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
        console.error("Error updating video URL:", error);
        toast({
          title: "Error",
          description: "Failed to update video URL",
          variant: "destructive",
        });
        return false;
      }

      // Update local state
      setProject(data);
      toast({
        title: "Success",
        description: newUrl.trim()
          ? "Video URL updated successfully"
          : "Video URL cleared successfully",
      });
      return true;
    } catch (error) {
      console.error("Error updating video URL:", error);
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
      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `project-materials/${fileName}`;

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from("project-materials")
        .upload(filePath, file);

      if (uploadError) {
        console.error("Error uploading additional materials:", uploadError);
        toast({
          title: "Upload Error",
          description: "Failed to upload file",
          variant: "destructive",
        });
        return false;
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("project-materials").getPublicUrl(filePath);

      // Update project with new URL
      const { data, error } = await updateProjectClient(projectId, {
        additional_materials_url: publicUrl,
      });

      if (error) {
        console.error("Error updating additional materials URL:", error);
        toast({
          title: "Error",
          description: "Failed to update additional materials URL",
          variant: "destructive",
        });
        return false;
      }

      // Update local state
      setProject(data);
      toast({
        title: "Success",
        description: "Additional materials uploaded and updated successfully",
      });
      return true;
    } catch (error) {
      console.error("Error uploading additional materials:", error);
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
        console.error("Error deleting project:", error);
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

      // Redirect to projects list
      router.push("/projects");
    } catch (error) {
      console.error("Error deleting project:", error);
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
        console.error("Error fetching participants:", error);
        return;
      }

      const participantList: EventParticipant[] = (data || [])
        .filter((role) => role.profiles?.email) // Filter out entries without email
        .map((role) => ({
          user_id: role.user_id,
          display_name:
            role.profiles?.display_name || role.profiles?.email || "",
          email: role.profiles?.email || "",
        }));

      setParticipants(participantList);
    } catch (error) {
      console.error("Error fetching participants:", error);
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

    // Basic email validation
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

    // Check if email is already the project lead
    if (normalizedEmail === project?.lead_email?.toLowerCase()) {
      toast({
        title: "Cannot add lead",
        description: "The project lead is already part of the team",
        variant: "destructive",
      });
      return;
    }

    // Check if email is already a teammate
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
        console.error("Error adding teammate:", error);
        toast({
          title: "Error",
          description: "Failed to add team member",
          variant: "destructive",
        });
        return;
      }

      // Update local state
      setProject(data);
      setNewTeammateEmail("");
      setSearchValue("");
      setSearchOpen(false);
      toast({
        title: "Team member added",
        description: `${normalizedEmail} has been successfully added to the team`,
      });
    } catch (error) {
      console.error("Error adding teammate:", error);
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
        console.error("Error removing teammate:", error);
        toast({
          title: "Error",
          description: "Failed to remove team member",
          variant: "destructive",
        });
        return;
      }

      // Update local state
      setProject(data);
      toast({
        title: "Team member removed",
        description: `${teammateEmail} has been removed from the team`,
      });
    } catch (error) {
      console.error("Error removing teammate:", error);
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
      // Create the Contextus project
      const contextusPayload = {
        label: project.project_name,
        metadata: {
          event: eventName || "Unknown Event",
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

      // Update the project with the Contextus ID
      const { data, error } = await updateProjectClient(projectId, {
        contextus_project_id: contextusId,
      });

      if (error) {
        console.error("Error updating project with Contextus ID:", error);
        toast({
          title: "Error",
          description: "Failed to save Contextus project ID",
          variant: "destructive",
        });
        return;
      }

      // Update local state
      setProject(data);
      toast({
        title: "Success",
        description: "Project linked to Contextus successfully",
      });
    } catch (error) {
      console.error("Error creating Contextus link:", error);
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
    <div className="container mx-auto px-4 py-8">
      <Toaster />
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/projects">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
        </Link>

        {/* Delete Button - Only show for project lead */}
        {isLead && (
          <div className="ml-auto">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isUpdating}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Project
            </Button>
          </div>
        )}
      </div>

      {/* Project Info */}
      <div className="mb-8">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            {/* Editable Title with Event Badge */}
            <div className="flex items-center gap-3 mb-2">
              <EditableField
                value={project.project_name}
                onSave={handleUpdateTitle}
                canEdit={canEdit}
                isLoading={isUpdating}
                displayClassName="text-3xl font-bold text-gray-900"
                inputClassName="text-3xl font-bold text-gray-900"
                renderDisplay={(value) => (
                  <h1 className="text-3xl font-bold text-gray-900 hover:text-blue-600">
                    {value}
                  </h1>
                )}
              />
              {/* Event Badge */}
              {eventName && project?.event_id && (
                <Link href={`/events/${eventSlug}/overview`}>
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-800 hover:bg-green-200 px-4 py-2 text-sm font-medium cursor-pointer transition-colors"
                  >
                    {eventName}
                  </Badge>
                </Link>
              )}
              {project.submitted ? (
                <Badge
                  variant="secondary"
                  className="bg-blue-100 text-blue-800 hover:bg-blue-200 px-4 py-2 text-sm font-medium cursor-pointer transition-colors"
                >
                  Submitted
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className="bg-gray-100 text-gray-800 hover:bg-gray-200 px-4 py-2 text-sm font-medium cursor-pointer transition-colors"
                >
                  Draft
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{totalMembers} members</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>
                  Created {new Date(project.created_at).toLocaleDateString()}
                </span>
              </div>
              <Badge variant={isLead ? "default" : "secondary"}>
                {isLead ? "Project Lead" : "Team Member"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Header Image */}
        <div className="w-full h-56 mb-6 rounded-lg overflow-hidden shadow-md">
          <div
            className="w-full h-full bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url(${
                project.cover_image_url || "/img/placeholder.png"
              })`,
            }}
          ></div>
        </div>

        {/* Project Description Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>About This Project</CardTitle>
          </CardHeader>
          <CardContent>
            <EditableField
              value={project.project_description}
              onSave={handleUpdateDescription}
              canEdit={canEdit}
              isLoading={isUpdating}
              multiline={true}
              displayClassName="text-gray-700"
              renderDisplay={(value) => (
                <p className="text-gray-700 hover:text-blue-600">{value}</p>
              )}
            />
          </CardContent>
        </Card>

        {/* Project Links Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Project Links</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Cover Image URL */}
            <div className=" mb-6">
              <div className="flex items-center gap-2 mb-3">
                <ExternalLink className="h-4 w-4 text-gray-500" />
                <label className="text-sm font-medium text-gray-700">
                  Cover Image:
                </label>
              </div>

              {/* URL Input */}
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

              {/* File Upload */}
              {canEdit && (
                <ImageUpload
                  handleUpload={handleCoverImageFileUpload}
                  noteText="Note: Changes to the cover image will be reflected in the header image above."
                />
              )}
            </div>

            {/* Additional Materials */}
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <ExternalLink className="h-4 w-4 text-gray-500" />
                <label className="text-sm font-medium text-gray-700">
                  Additional Materials:
                </label>
              </div>

              {/* URL Input */}
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
              {canEdit && (
                <FileUpload
                  handleUpload={handleAdditionalMaterialsFileUpload}
                  noteText="Examples: GitHub repository, documentation, slides, design files, PDFs, etc."
                />
              )}
            </div>

            {/* Project URL */}
            <div className="border-t pt-4 mt-4">
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
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center gap-2 mb-2">
                <ExternalLink className="h-4 w-4 text-gray-500" />
                <label className="text-sm font-medium text-gray-700">
                  Video URL:
                </label>
              </div>
              <div className="flex gap-2 mb-4">
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

              {/* Video Embed */}
              {project.video_url && canEmbed(project.video_url) && (
                <VideoEmbed url={project.video_url} title="Project Video" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Integrations Card */}
        {!canEdit && isAdmin && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Integrations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Contextus Integration */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">Contextus</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Connect your project to Contextus for enhanced
                        visibility
                      </p>
                    </div>
                    {!project.contextus_project_id ? (
                      <Button
                        onClick={handleCreateContextusLink}
                        disabled={isUpdating}
                        className="flex items-center gap-2"
                      >
                        <OpenInNew className="h-4 w-4" />
                        Link on Contextus
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="bg-green-100 text-green-800"
                        >
                          Connected
                        </Badge>
                        <Button
                          onClick={() => setShowContextusId(!showContextusId)}
                          variant="ghost"
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          {showContextusId ? (
                            <>
                              <EyeOff className="w-4 h-4" />
                              Hide ID
                            </>
                          ) : (
                            <>
                              <Eye className="w-4 h-4" />
                              Show ID
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                  {project.contextus_project_id && showContextusId && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-sm text-gray-600">Project ID:</span>
                      <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-purple-700">
                        {project.contextus_project_id}
                      </code>
                      <Button
                        onClick={() => {
                          navigator.clipboard.writeText(
                            project.contextus_project_id!
                          );
                          toast({
                            title: "Copied",
                            description: "Contextus ID copied to clipboard",
                          });
                        }}
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 h-auto gap-4 w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="team">
            <Users className="h-4 w-4 mr-2" />
            Team ({totalMembers})
          </TabsTrigger>
          <TabsTrigger value="tracks">
            <Tag className="h-4 w-4 mr-2" />
            Tracks
          </TabsTrigger>
          <TabsTrigger value="feedback">
            <MessageSquare className="h-4 w-4 mr-2" />
            Feedback
          </TabsTrigger>
          <TabsTrigger value="qr-code">
            <QrCode className="h-4 w-4 mr-2" />
            QR Code
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Project Lead
                  </label>
                  <p className="text-gray-900">
                    {project.lead_name} ({project.lead_email})
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Team Size
                  </label>
                  <p className="text-gray-900">{totalMembers} members</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Created
                  </label>
                  <p className="text-gray-900">
                    {new Date(project.created_at).toLocaleDateString()}
                  </p>
                </div>
                {/* Contextus Integration - Only show to team members */}
                {canEdit && project.contextus_project_id && (
                  <div className="border-t pt-3 mt-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-500">
                        Contextus Integration
                      </label>
                      <Button
                        onClick={() => setShowContextusId(!showContextusId)}
                        variant="ghost"
                        size="sm"
                        className="flex items-center gap-2 h-8"
                      >
                        {showContextusId ? (
                          <>
                            <EyeOff className="w-4 h-4" />
                            Hide ID
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4" />
                            Reveal ID
                          </>
                        )}
                      </Button>
                    </div>
                    {showContextusId && (
                      <div className="mt-2 flex items-center gap-2">
                        <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-purple-700">
                          {project.contextus_project_id}
                        </code>
                        <Button
                          onClick={() => {
                            navigator.clipboard.writeText(
                              project.contextus_project_id!
                            );
                            toast({
                              title: "Copied",
                              description: "Contextus ID copied to clipboard",
                            });
                          }}
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team">
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
                    {/* Search through event participants */}
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

                    {/* Manual email input as fallback */}
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

        <TabsContent value="tracks">
          <TrackSelector
            projectId={project.id}
            eventId={project.event_id}
            canEdit={canEdit}
            isLoading={isUpdating}
          />
        </TabsContent>

        <TabsContent value="feedback">
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

        <TabsContent value="qr-code">
          <ProjectQRCodeSection
            fullUrl={feedbackUrl}
            onCopyQR={handleCopyQR}
            onDownloadQR={handleDownloadQR}
          />
        </TabsContent>
      </Tabs>

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
    </div>
  );
}
