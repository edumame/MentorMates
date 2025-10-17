"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageContainer, PageContent } from "@/components/layout/PageContainer";
import {
  Loader2,
  Image as ImageIcon,
  Paperclip,
  Github,
  Youtube,
  Trash2,
  Shield,
  ExternalLink,
  ThumbsUp,
  MessageSquarePlus,
  Calendar,
  MoreHorizontal,
} from "lucide-react";
import { Session } from "@supabase/supabase-js";
import { toast } from "@/lib/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { Project } from "@/lib/types";
import { updateProjectClient } from "@/features/projects/client-actions/client-update";
import { updateProjectTeamClient } from "@/features/projects/client-actions/client-update";
import { deleteProjectClient } from "@/features/projects/client-actions/client-delete";
import UserSearch from "@/components/utils/UserSearch";
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

interface EventParticipant {
  user_id: string;
  display_name: string;
  email: string;
}

export default function ProjectEditPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [session, setSession] = useState<Session | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    project_name: "",
    project_description: "",
    project_url: "",
    video_url: "",
    cover_image_url: "",
    additional_materials_url: "",
  });

  // Team management
  const [participants, setParticipants] = useState<EventParticipant[]>([]);

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);
    };

    getSession();
  }, []);

  useEffect(() => {
    if (session?.user?.email) {
      fetchProject();
    }
  }, [session, projectId]);

  useEffect(() => {
    if (project?.event_id) {
      fetchEventParticipants();
    }
  }, [project?.event_id]);

  const fetchProject = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (error) {
        toast({
          title: "Error",
          description: "Failed to load project",
          variant: "destructive",
        });
        router.push("/projects");
        return;
      }

      setProject(data);

      // Check if user can edit
      if (session?.user?.email) {
        const userEmail = session.user.email;
        const isLead = data.lead_email === userEmail;
        const isTeammate = data.teammates?.includes(userEmail);
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

      // Initialize form data
      setFormData({
        project_name: data.project_name || "",
        project_description: data.project_description || "",
        project_url: data.project_url || "",
        video_url: data.video_url || "",
        cover_image_url: data.cover_image_url || "",
        additional_materials_url: data.additional_materials_url || "",
      });
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
  };

  const fetchEventParticipants = useCallback(async () => {
    if (!project?.event_id) return;

    try {
      const { data } = await supabase
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

      const participantList: EventParticipant[] = (data || [])
        .filter((role) => role.profiles?.email)
        .map((role) => ({
          user_id: role.user_id,
          display_name:
            role.profiles?.display_name || role.profiles?.email || "",
          email: role.profiles?.email || "",
        }));

      setParticipants(participantList);
    } catch {
      // Silently fail if participants cannot be fetched
    }
  }, [project?.event_id]);

  // Auto-save functionality with debounce
  useEffect(() => {
    if (!project || isLoading) return;

    const timer = setTimeout(() => {
      handleAutoSave();
    }, 2000);

    return () => clearTimeout(timer);
  }, [formData]);

  const handleAutoSave = async () => {
    if (!project || isLoading || isSaving) return;

    // Check if anything changed
    const hasChanges =
      formData.project_name !== (project.project_name || "") ||
      formData.project_description !== (project.project_description || "") ||
      formData.project_url !== (project.project_url || "") ||
      formData.video_url !== (project.video_url || "") ||
      formData.cover_image_url !== (project.cover_image_url || "") ||
      formData.additional_materials_url !== (project.additional_materials_url || "");

    if (!hasChanges) return;

    setIsSaving(true);
    try {
      const { data } = await updateProjectClient(projectId, {
        project_name: formData.project_name.trim() || undefined,
        project_description: formData.project_description.trim() || undefined,
        project_url: formData.project_url.trim() || undefined,
        video_url: formData.video_url.trim() || null,
        cover_image_url: formData.cover_image_url.trim() || undefined,
        additional_materials_url: formData.additional_materials_url.trim() || undefined,
      });

      if (data) {
        setProject(data);
        setLastSaved(new Date());
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("project-materials").getPublicUrl(filePath);

      setFormData((prev) => ({ ...prev, cover_image_url: publicUrl }));

      toast({
        title: "Success",
        description: "Cover image uploaded successfully",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to upload cover image",
        variant: "destructive",
      });
    }
  };

  const handleAdditionalMaterialsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("project-materials").getPublicUrl(filePath);

      setFormData((prev) => ({ ...prev, additional_materials_url: publicUrl }));

      toast({
        title: "Success",
        description: "Additional materials uploaded successfully",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to upload additional materials",
        variant: "destructive",
      });
    }
  };

  const handleTeammatesChange = async (emails: string[]) => {
    if (!project) return;

    try {
      // Filter out the lead email
      const validEmails = emails.filter(
        (email) => email.toLowerCase() !== project.lead_email?.toLowerCase()
      );

      const { data } = await updateProjectTeamClient(projectId, validEmails);

      if (data) {
        setProject(data);
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to update team members",
        variant: "destructive",
      });
    }
  };

  const handleRemoveTeammate = async (teammateEmail: string) => {
    try {
      const currentTeammates = project?.teammates || [];
      const updatedTeammates = currentTeammates.filter((email) => email !== teammateEmail);
      const { data } = await updateProjectTeamClient(projectId, updatedTeammates);

      if (data) {
        setProject(data);
        toast({
          title: "Team member removed",
          description: `${teammateEmail} has been removed from the team`,
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to remove team member",
        variant: "destructive",
      });
    }
  };

  const handleDeleteProject = async () => {
    setIsDeleting(true);
    try {
      const { success } = await deleteProjectClient(projectId);

      if (success) {
        toast({
          title: "Project deleted",
          description: "Your project has been successfully deleted",
        });
        router.push("/projects");
      }
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handlePublish = async () => {
    // Validate required fields
    if (!formData.project_name.trim()) {
      toast({
        title: "Missing Information",
        description: "Project name is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.project_description.trim()) {
      toast({
        title: "Missing Information",
        description: "Project description is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data } = await updateProjectClient(projectId, {
        submitted: true,
      });

      if (data) {
        setProject(data);
        toast({
          title: "Project published",
          description: "Your project is now public",
        });
        router.push(`/projects/${projectId}`);
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to publish project",
        variant: "destructive",
      });
    }
  };

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

  const isLead = session?.user?.email === project.lead_email;
  const totalMembers = (project.teammates?.length || 0) + 1;

  return (
    <PageContainer>
      <Toaster />
      <PageContent className="flex flex-col">
        {/* Sticky Auto-save Banner */}
        <div className="sticky top-0 z-40 bg-sky-50 border-b border-[#d8d8d8]">
          <div className="max-w-[1280px] mx-auto px-6 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-[#4c4c4c]" />
              <p className="text-[#4c4c4c] text-lg font-medium tracking-[-0.06em]">
                Your project is automatically saved as you edit
              </p>
            </div>
            {lastSaved && (
              <div className="bg-transparent border border-[rgba(0,0,0,0.15)] rounded-full px-2.5 py-1">
                <p className="text-[#7f7f7f] text-sm font-medium">
                  Saved at {lastSaved.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })} {lastSaved.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-gradient-to-br from-blue-100/45 via-transparent to-transparent">
          <div className="max-w-[1280px] mx-auto px-8 py-6 min-h-[800px]">
          <div className="flex gap-12 items-start justify-between">
            {/* Left Side - Form */}
            <div className="flex-1 max-w-[640px] space-y-6">
              <div className="space-y-1">
                <h1 className="text-[28px] font-semibold text-black tracking-[-0.06em] leading-[1.4]">
                  Edit your project
                </h1>
              </div>

              <div className="space-y-4">
                {/* Project Name */}
                <div className="space-y-2">
                  <label className="text-base text-black font-normal">Project name</label>
                  <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 flex items-center gap-3 h-11">
                    <Input
                      value={formData.project_name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, project_name: e.target.value }))}
                      placeholder="Snapdragon AI: Multilingual Translator"
                      className="border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
                    />
                  </div>
                </div>

                {/* Project Description */}
                <div className="space-y-2">
                  <label className="text-base text-black font-normal">Project Description</label>
                  <Textarea
                    value={formData.project_description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, project_description: e.target.value }))}
                    placeholder="Describe your project..."
                    rows={7}
                    className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 text-base resize-none"
                  />
                  <p className="text-base text-[#7f7f7f]">*This will show under the project overview section</p>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200" />

                {/* Cover Image */}
                <div className="space-y-2">
                  <label className="text-base text-black font-normal">Cover image</label>
                  <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 flex items-center gap-3 h-11">
                    <ImageIcon className="h-6 w-6 shrink-0" />
                    <Input
                      value={formData.cover_image_url}
                      onChange={(e) => setFormData((prev) => ({ ...prev, cover_image_url: e.target.value }))}
                      placeholder="https://www.mentormates.ai/projects/..."
                      className="border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 text-base truncate"
                    />
                    <label className="bg-[rgba(0,0,0,0.05)] shadow-sm rounded-xl px-3 py-1 cursor-pointer shrink-0">
                      <input type="file" accept="image/*" onChange={handleCoverImageUpload} className="hidden" />
                      <span className="text-xs text-black font-normal">Upload</span>
                    </label>
                  </div>
                  <p className="text-base text-[#7f7f7f]">*Upload an image to showcase your project (Max 10MB)</p>
                </div>

                {/* Additional Materials */}
                <div className="space-y-2">
                  <label className="text-base text-black font-normal">Additional materials</label>
                  <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 flex items-center gap-3 h-11">
                    <Paperclip className="h-6 w-6 shrink-0" />
                    <Input
                      value={formData.additional_materials_url}
                      onChange={(e) => setFormData((prev) => ({ ...prev, additional_materials_url: e.target.value }))}
                      placeholder="https://www.mentormates.ai/projects/..."
                      className="border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 text-base truncate"
                    />
                    <label className="bg-[rgba(0,0,0,0.05)] shadow-sm rounded-xl px-3 py-1 cursor-pointer shrink-0">
                      <input type="file" onChange={handleAdditionalMaterialsUpload} className="hidden" />
                      <span className="text-xs text-black font-normal">Upload</span>
                    </label>
                  </div>
                  <p className="text-base text-[#7f7f7f]">*Upload any additional documentation (Max 10MB)</p>
                </div>

                {/* GitHub or Live Link */}
                <div className="space-y-2">
                  <label className="text-base text-black font-normal">GitHub or live link (Optional)</label>
                  <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 flex items-center gap-3 h-11">
                    <Github className="h-6 w-6 shrink-0" />
                    <Input
                      value={formData.project_url}
                      onChange={(e) => setFormData((prev) => ({ ...prev, project_url: e.target.value }))}
                      placeholder="https://..."
                      className="border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 text-base text-[rgba(0,0,0,0.6)]"
                    />
                  </div>
                </div>

                {/* Video Link */}
                <div className="space-y-2">
                  <label className="text-base text-black font-normal">Video link (Optional)</label>
                  <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 flex items-center gap-3 h-11">
                    <Youtube className="h-6 w-6 shrink-0" />
                    <Input
                      value={formData.video_url}
                      onChange={(e) => setFormData((prev) => ({ ...prev, video_url: e.target.value }))}
                      placeholder="https://..."
                      className="border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 text-base text-[rgba(0,0,0,0.6)]"
                    />
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200" />

                {/* Add Teammates */}
                <div className="space-y-2">
                  <label className="text-base text-black font-normal">Add teammates (Optional)</label>
                  <UserSearch
                    allTags={participants.map((p) => p.email)}
                    onTagsChange={handleTeammatesChange}
                    initialTags={project.teammates || []}
                  />

                  {/* Team Members List */}
                  <div className="border border-gray-200 rounded-xl p-3 space-y-4 mt-4">
                    {/* Lead */}
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-gray-300 shrink-0" />
                      <div className="space-y-0">
                        <div className="flex items-center gap-1">
                          <p className="text-base font-semibold text-black">{project.lead_name}</p>
                          <Badge variant="secondary" className="bg-transparent border border-[rgba(0,0,0,0.15)] text-black rounded-full text-sm font-semibold">
                            Lead
                          </Badge>
                        </div>
                        <p className="text-base text-black">{project.lead_email}</p>
                      </div>
                    </div>

                    {project.teammates && project.teammates.length > 0 && (
                      <>
                        <div className="border-t border-gray-200" />
                        {project.teammates.map((teammate, index) => (
                          <div key={index} className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-full bg-gray-300 shrink-0" />
                            <div className="flex-1">
                              <p className="text-base font-semibold text-black">{teammate}</p>
                              <p className="text-base text-black">{teammate}</p>
                            </div>
                            {isLead && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveTeammate(teammate)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

              {/* Right Side - Preview & Actions */}
            <div className="space-y-6">
              {/* Action Buttons */}
              <div className="flex items-center gap-1 justify-end">
                {isLead && (
                  <Button
                    onClick={() => setShowDeleteDialog(true)}
                    className="bg-red-600 hover:bg-red-700 text-white rounded-xl px-6 py-2.5 shadow-sm font-medium"
                  >
                    <Trash2 className="h-6 w-6 mr-1.5" />
                    Delete
                  </Button>
                )}
                <Button
                  onClick={handlePublish}
                  className="bg-[#4b89ef] hover:bg-[#3d75d9] text-white rounded-xl px-6 py-2.5 shadow-sm font-medium"
                >
                  Publish project
                </Button>
              </div>

              {/* Preview Card */}
              <div className="space-y-3">
                <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl overflow-hidden w-[339px]">
                  {/* Cover Image */}
                  <div className="aspect-[339/220] relative">
                    {formData.cover_image_url ? (
                      <img src={formData.cover_image_url} alt="Cover" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-orange-400 via-blue-500 to-purple-600" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-6 space-y-3">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-[22px] font-semibold text-black tracking-[-0.06em] leading-[1.4]">
                            {formData.project_name || "Relief Map"}
                          </h3>
                          <Badge variant="secondary" className="bg-white border border-[rgba(0,0,0,0.15)] text-black rounded-full text-sm">
                            <Loader2 className="h-4.5 w-4.5 mr-1" />
                            Public
                          </Badge>
                          <Badge variant="secondary" className="bg-white border border-[rgba(0,0,0,0.15)] text-black rounded-full text-sm">
                            Owner
                          </Badge>
                        </div>
                        <p className="text-base text-black line-clamp-2">
                          {formData.project_description || "Join the community and enter weekly raffles for free conference tickets and VIP upgrades, plus free credits for top AI and SaaS tools."}
                        </p>
                      </div>

                      {/* Metadata */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-5 w-5 text-[#575d65]" />
                          <span className="text-sm text-[#575d65]">11 Jan 2025</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <ThumbsUp className="h-5 w-5 text-[#575d65]" />
                          <span className="text-sm text-[#575d65]">36</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageSquarePlus className="h-5 w-5 text-[#575d65]" />
                          <span className="text-sm text-[#575d65]">2</span>
                        </div>
                      </div>
                    </div>

                    {/* Team & Menu */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center -space-x-2">
                        {[...Array(Math.min(totalMembers, 4))].map((_, i) => (
                          <div key={i} className="w-10 h-10 rounded-full bg-gray-300 border-2 border-white" />
                        ))}
                      </div>
                      <MoreHorizontal className="h-6 w-6 text-[#7f7f7f]" />
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => router.push(`/projects/${projectId}`)}
                  className="flex items-center gap-1 justify-center text-[#7f7f7f] hover:text-black transition-colors"
                >
                  <span className="text-base">Preview project page</span>
                  <ExternalLink className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
        </div>
      </PageContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the project
              <strong> &quot;{project?.project_name}&quot;</strong> and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? "Deleting..." : "Delete Project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
