"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectDescription } from "@/components/projects/ProjectDescription";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Image as ImageIcon,
  Paperclip,
  Github,
  Youtube,
  Trash2,
  ExternalLink,
  ThumbsUp,
  MessageSquarePlus,
  Calendar,
  MoreHorizontal,
} from "lucide-react";
import { Session } from "@supabase/supabase-js";
import { toast } from "@/lib/hooks/use-toast";
import { Project } from "@/lib/types";
import { updateProjectTeamClient } from "@/features/projects/client-actions/client-update";
import { deleteProjectClient } from "@/features/projects/client-actions/client-delete";
import UserSearchWithInvite from "@/components/utils/UserSearchWithInvite";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TextFields } from "@mui/icons-material";
import { ParticipantIntakeDialog } from "@/features/intake-forms/components/ParticipantIntakeDialog";
import {
  buildDraftArtifactsPayload,
  hasDraftUrlListChanged,
  normalizeDraftUrls,
  splitPrimaryAndExtrasFromArtifacts,
} from "@/features/projects/components/forms/utils/draftProjectArtifacts";
import type {
  IntakeFormAnswers,
  IntakeFormSchema,
} from "@/features/intake-forms/types";

interface EventParticipant {
  user_id: string;
  display_name: string;
  email: string;
}

interface EventOption {
  event_id: string;
  event_name: string;
  submission_time_start: string;
  submission_time_cutoff: string;
  event_date: string;
}

interface EventTrack {
  track_id: string;
  name: string;
  description?: string;
}

interface DraftProjectSubmissionFormProps {
  projectId: string;
  session: Session | null;
  project: Project;
  canEdit: boolean;
  onProjectUpdate?: (project: Project) => void;
}

interface ActiveIntakeForm {
  formVersionId: string;
  schema: IntakeFormSchema;
}

export default function DraftProjectSubmissionFormSinglePage({
  projectId,
  session,
  project: initialProject,
  canEdit,
  onProjectUpdate,
}: DraftProjectSubmissionFormProps) {
  const router = useRouter();

  const [project, setProject] = useState<Project>(initialProject);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeIntakeForm, setActiveIntakeForm] =
    useState<ActiveIntakeForm | null>(null);
  const [showIntakeDialog, setShowIntakeDialog] = useState(false);
  const [showDescriptionPreview, setShowDescriptionPreview] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    project_name: initialProject.project_name || "",
    project_description: initialProject.project_description || "",
    project_url: initialProject.project_url || "",
    video_url: initialProject.video_url || "",
    cover_image_url: initialProject.cover_image_url || "",
    additional_materials_url: initialProject.additional_materials_url || "",
  });
  const [extraProjectUrls, setExtraProjectUrls] = useState<string[]>([]);
  const [extraVideoUrls, setExtraVideoUrls] = useState<string[]>([]);
  const [extraMaterialsUrls, setExtraMaterialsUrls] = useState<string[]>([]);
  const [savedExtraProjectUrls, setSavedExtraProjectUrls] = useState<string[]>(
    []
  );
  const [savedExtraVideoUrls, setSavedExtraVideoUrls] = useState<string[]>([]);
  const [savedExtraMaterialsUrls, setSavedExtraMaterialsUrls] = useState<
    string[]
  >([]);

  // Team management
  const [participants, setParticipants] = useState<EventParticipant[]>([]);

  // Event selection
  const [availableEvents, setAvailableEvents] = useState<EventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>(
    initialProject.event_id
  );
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  // Track selection
  const [availableTracks, setAvailableTracks] = useState<EventTrack[]>([]);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);

  const fetchAvailableEvents = useCallback(async () => {
    setIsLoadingEvents(true);
    try {
      if (!session?.user?.id) {
        setAvailableEvents([]);
        return;
      }

      // Fetch events where the user has a role
      const { data, error } = await supabase
        .from("user_event_roles")
        .select(
          `
          event_id,
          events:event_id (
            event_id,
            event_name,
            submission_time_start,
            submission_time_cutoff,
            event_date,
            visibility
          )
        `
        )
        .eq("user_id", session.user.id);

      if (error) {
        console.error("Error fetching events:", error);
        return;
      }

      // Filter and map events
      const events: EventOption[] = (data || [])
        .filter((role) => {
          const event = role.events as unknown as {
            event_id: string;
            event_name: string;
            submission_time_start: string | null;
            submission_time_cutoff: string | null;
            event_date: string;
            visibility: string;
          } | null;

          // Only include public and private events
          return (
            event
          );
        })
        .map((role) => {
          const event = role.events as unknown as {
            event_id: string;
            event_name: string;
            submission_time_start: string | null;
            submission_time_cutoff: string | null;
            event_date: string;
          };

          return {
            event_id: event.event_id,
            event_name: event.event_name,
            submission_time_start: event.submission_time_start || "",
            submission_time_cutoff: event.submission_time_cutoff || "",
            event_date: event.event_date,
          };
        })
        .sort(
          (a, b) =>
            new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
        );

      setAvailableEvents(events);
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setIsLoadingEvents(false);
    }
  }, [session?.user?.id]);

  const fetchEventParticipants = useCallback(async () => {
    if (!project?.event_id) return;

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
    } catch {
      // Silently fail if participants cannot be fetched
    }
  }, [project?.event_id]);

  const fetchEventTracks = useCallback(async (eventId: string) => {
    setIsLoadingTracks(true);
    try {
      const { data, error } = await supabase
        .from("event_tracks")
        .select("track_id, name, description")
        .eq("event_id", eventId);

      if (error) {
        console.error("Error fetching event tracks:", error);
        setAvailableTracks([]);
        return;
      }

      const tracks: EventTrack[] = (data || []).map((track) => ({
        track_id: track.track_id,
        name: track.name,
        description: track.description || undefined,
      }));

      setAvailableTracks(tracks);
    } catch (error) {
      console.error("Error fetching event tracks:", error);
      setAvailableTracks([]);
    } finally {
      setIsLoadingTracks(false);
    }
  }, []);

  const fetchProjectTracks = useCallback(async () => {
    if (!projectId) return;

    try {
      const { data, error } = await supabase
        .from("project_tracks")
        .select("track_id")
        .eq("project_id", projectId);

      if (error) {
        console.error("Error fetching project tracks:", error);
        return;
      }

      const trackIds = (data || []).map((pt) => pt.track_id);
      setSelectedTrackIds(trackIds);
    } catch (error) {
      console.error("Error fetching project tracks:", error);
    }
  }, [projectId]);

  const buildArtifactsPayload = useCallback(() => {

    return buildDraftArtifactsPayload({
      projectUrl: formData.project_url,
      videoUrl: formData.video_url,
      additionalMaterialsUrl: formData.additional_materials_url,
      extraProjectUrls,
      extraVideoUrls,
      extraMaterialsUrls,
    });
  }, [
    formData.project_url,
    formData.video_url,
    formData.additional_materials_url,
    extraProjectUrls,
    extraVideoUrls,
    extraMaterialsUrls,
  ]);

  // Effects
  useEffect(() => {
    if (project?.event_id) {
      fetchEventParticipants();
      setSelectedEventId(project.event_id);
      fetchEventTracks(project.event_id);
      fetchProjectTracks();
    }
  }, [project?.event_id, fetchEventParticipants, fetchEventTracks, fetchProjectTracks]);

  useEffect(() => {
    const fetchArtifactByKind = async (
      kind: "project_link" | "video_link" | "additional_material"
    ) => {
      const { data, error } = await supabase
        .from("project_artifacts")
        .select("url, sort_order, is_primary")
        .eq("project_id", projectId)
        .eq("kind", kind)
        .order("sort_order", { ascending: true });

      if (error || !data || data.length === 0) {
        return { primaryUrl: "", extraUrls: [] };
      }

      return splitPrimaryAndExtrasFromArtifacts(data);
    };

    const fetchArtifacts = async () => {
      const [projectLinks, videoLinks, materialLinks] = await Promise.all([
        fetchArtifactByKind("project_link"),
        fetchArtifactByKind("video_link"),
        fetchArtifactByKind("additional_material"),
      ]);

      setFormData((prev) => ({
        ...prev,
        project_url: projectLinks.primaryUrl || prev.project_url,
        video_url: videoLinks.primaryUrl || prev.video_url,
        additional_materials_url:
          materialLinks.primaryUrl || prev.additional_materials_url,
      }));

      setExtraProjectUrls(projectLinks.extraUrls);
      setExtraVideoUrls(videoLinks.extraUrls);
      setExtraMaterialsUrls(materialLinks.extraUrls);
      setSavedExtraProjectUrls(normalizeDraftUrls(projectLinks.extraUrls));
      setSavedExtraVideoUrls(normalizeDraftUrls(videoLinks.extraUrls));
      setSavedExtraMaterialsUrls(normalizeDraftUrls(materialLinks.extraUrls));
    };

    fetchArtifacts();
    // We only need this hydration once for the loaded draft project.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    fetchAvailableEvents();
  }, [fetchAvailableEvents]);

  useEffect(() => {
    // Update parent component when project changes
    if (onProjectUpdate) {
      onProjectUpdate(project);
    }
  }, [project, onProjectUpdate]);

  // Auto-save functionality with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      handleAutoSave();
    }, 2000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, extraProjectUrls, extraVideoUrls, extraMaterialsUrls]);

  const handleAutoSave = async () => {
    if (isSaving) return;

    // Check if anything changed
    const hasChanges =
      formData.project_name !== (project.project_name || "") ||
      formData.project_description !== (project.project_description || "") ||
      formData.project_url !== (project.project_url || "") ||
      formData.video_url !== (project.video_url || "") ||
      formData.cover_image_url !== (project.cover_image_url || "") ||
      formData.additional_materials_url !==
        (project.additional_materials_url || "") ||
      hasDraftUrlListChanged(extraProjectUrls, savedExtraProjectUrls) ||
      hasDraftUrlListChanged(extraVideoUrls, savedExtraVideoUrls) ||
      hasDraftUrlListChanged(extraMaterialsUrls, savedExtraMaterialsUrls);

    if (!hasChanges) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_name: formData.project_name.trim() || undefined,
          project_description: formData.project_description.trim() || undefined,
          project_url: formData.project_url.trim() || undefined,
          video_url: formData.video_url.trim() || null,
          cover_image_url: formData.cover_image_url.trim() || undefined,
          additional_materials_url:
            formData.additional_materials_url.trim() || undefined,
          extra_project_urls: normalizeDraftUrls(extraProjectUrls),
          extra_video_urls: normalizeDraftUrls(extraVideoUrls),
          extra_materials_urls: normalizeDraftUrls(extraMaterialsUrls),
          artifacts: buildArtifactsPayload(),
        }),
      });

      if (response.ok) {
        const json = (await response.json()) as { project?: Project };
        if (json.project) {
          setProject(json.project);
        }
        setSavedExtraProjectUrls(normalizeDraftUrls(extraProjectUrls));
        setSavedExtraVideoUrls(normalizeDraftUrls(extraVideoUrls));
        setSavedExtraMaterialsUrls(normalizeDraftUrls(extraMaterialsUrls));
        setLastSaved(new Date());
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCoverImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
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

  const handleAdditionalMaterialsUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const input = e.currentTarget;
    const file = e.target.files?.[0];
    if (!file) return;

    const publicUrl = await uploadAdditionalMaterialFile(file);
    input.value = "";
    if (!publicUrl) return;

    setFormData((prev) => ({ ...prev, additional_materials_url: publicUrl }));

    toast({
      title: "Success",
      description: "Additional materials uploaded successfully",
    });
  };

  const uploadAdditionalMaterialFile = async (file: File) => {
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
        return null;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("project-materials").getPublicUrl(filePath);

      return publicUrl;
    } catch {
      toast({
        title: "Error",
        description: "Failed to upload additional materials",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleAdditionalMaterialsExtraUpload = async (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const input = e.currentTarget;
    const file = e.target.files?.[0];
    if (!file) return;

    const publicUrl = await uploadAdditionalMaterialFile(file);
    input.value = "";
    if (!publicUrl) return;

    setExtraMaterialsUrls((prev) =>
      prev.map((item, itemIndex) => (itemIndex === index ? publicUrl : item))
    );

    toast({
      title: "Success",
      description: "Additional material link updated from upload",
    });
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
      const updatedTeammates = currentTeammates.filter(
        (email) => email !== teammateEmail
      );
      const { data } = await updateProjectTeamClient(
        projectId,
        updatedTeammates
      );

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

  const handleEventChange = async (newEventId: string) => {
    if (newEventId === project.event_id) return;

    // Validate submission time before updating
    const selectedEvent = availableEvents.find(
      (e) => e.event_id === newEventId
    );

    if (!selectedEvent) {
      toast({
        title: "Error",
        description: "Selected event not found",
        variant: "destructive",
      });
      return;
    }

    const now = new Date();
    const submissionStart = new Date(selectedEvent.submission_time_start);
    const submissionCutoff = new Date(selectedEvent.submission_time_cutoff);

    if (now < submissionStart) {
      toast({
        title: "Submission Not Open",
        description: `Submissions for "${selectedEvent.event_name}" haven't started yet. Opens on ${submissionStart.toLocaleDateString()}`,
        variant: "destructive",
      });
      return;
    }

    if (now > submissionCutoff) {
      toast({
        title: "Submission Closed",
        description: `Submissions for "${selectedEvent.event_name}" closed on ${submissionCutoff.toLocaleDateString()}`,
        variant: "destructive",
      });
      return;
    }

    // Update via API
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: newEventId }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast({
          title: "Error",
          description: result.error || "Failed to update event",
          variant: "destructive",
        });
        return;
      }

      setSelectedEventId(newEventId);
      setProject({ ...project, event_id: newEventId });

      toast({
        title: "Event Updated",
        description: `Project moved to "${selectedEvent.event_name}"`,
      });

      // Refresh participants and tracks for new event
      fetchEventParticipants();
      fetchEventTracks(newEventId);
      
      // Clear selected tracks when event changes
      setSelectedTrackIds([]);
    } catch {
      toast({
        title: "Error",
        description: "Failed to update event",
        variant: "destructive",
      });
    }
  };

  const handleTrackToggle = async (trackId: string, checked: boolean) => {
    const newTrackIds = checked
      ? [...selectedTrackIds, trackId]
      : selectedTrackIds.filter((id) => id !== trackId);

    setSelectedTrackIds(newTrackIds);

    // Update tracks in database
    try {
      // Delete existing tracks
      await supabase
        .from("project_tracks")
        .delete()
        .eq("project_id", projectId);

      // Insert new tracks
      if (newTrackIds.length > 0) {
        const trackInserts = newTrackIds.map((tid) => ({
          project_id: projectId,
          track_id: tid,
        }));

        const { error } = await supabase
          .from("project_tracks")
          .insert(trackInserts);

        if (error) {
          throw error;
        }
      }

      toast({
        title: "Tracks Updated",
        description: "Project tracks have been updated successfully",
      });
    } catch (error) {
      console.error("Error updating tracks:", error);
      toast({
        title: "Error",
        description: "Failed to update project tracks",
        variant: "destructive",
      });
      // Revert the state on error
      fetchProjectTracks();
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

  const publishProjectWithArtifacts = async (): Promise<Project | null> => {
    const response = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_name: formData.project_name.trim() || undefined,
        project_description: formData.project_description.trim() || undefined,
        project_url: formData.project_url.trim() || undefined,
        video_url: formData.video_url.trim() || null,
        cover_image_url: formData.cover_image_url.trim() || undefined,
        additional_materials_url:
          formData.additional_materials_url.trim() || undefined,
        extra_project_urls: normalizeDraftUrls(extraProjectUrls),
        extra_video_urls: normalizeDraftUrls(extraVideoUrls),
        extra_materials_urls: normalizeDraftUrls(extraMaterialsUrls),
        artifacts: buildArtifactsPayload(),
        submitted: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to publish project");
    }

    const json = (await response.json()) as { project?: Project };
    return json.project || null;
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
      if (project.event_id) {
        const intakeResponse = await fetch(
          `/api/events/${project.event_id}/intake-form?context=project_submission`,
          { cache: "no-store" }
        );

        if (intakeResponse.ok) {
          const intakeData = (await intakeResponse.json()) as {
            form: ActiveIntakeForm | null;
          };

          if (intakeData.form?.formVersionId && intakeData.form.schema) {
            setActiveIntakeForm(intakeData.form);
            setShowIntakeDialog(true);
            return;
          }
        }
      }

      const data = await publishProjectWithArtifacts();

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

  const handleIntakeSubmit = async (answers: IntakeFormAnswers) => {
    if (!project.event_id || !activeIntakeForm?.formVersionId) {
      toast({
        title: "Error",
        description: "Missing intake form metadata.",
        variant: "destructive",
      });
      return;
    }

    try {
      const data = await publishProjectWithArtifacts();

      if (!data) {
        throw new Error("Failed to publish project");
      }

      const intakeResponse = await fetch(
        `/api/events/${project.event_id}/intake-form/submissions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            context: "project_submission",
            formVersionId: activeIntakeForm.formVersionId,
            projectId,
            answers,
          }),
        }
      );

      if (!intakeResponse.ok) {
        const intakeError = await intakeResponse.json().catch(() => ({}));
        throw new Error(intakeError.error || "Failed to submit intake form");
      }

      setProject(data);
      setShowIntakeDialog(false);
      toast({
        title: "Project published",
        description: "Your project and intake form are now submitted.",
      });
      router.push(`/projects/${projectId}`);
    } catch {
      toast({
        title: "Error",
        description: "Failed to publish project",
        variant: "destructive",
      });
    }
  };

  if (!project || !canEdit) {
    return null;
  }

  const isLead = session?.user?.email === project.lead_email;
  const totalMembers = (project.teammates?.length || 0) + 1;

  return (
    <>
      {activeIntakeForm ? (
        <ParticipantIntakeDialog
          open={showIntakeDialog}
          schema={activeIntakeForm.schema}
          onClose={() => setShowIntakeDialog(false)}
          onSubmit={handleIntakeSubmit}
        />
      ) : null}
      {/* Sticky Auto-save Banner */}
      <div className="sticky top-0 z-40 bg-sky-50 border-b border-[#d8d8d8]">
        <div className="mx-auto px-6 py-3.5 flex items-center justify-between flex-wrap">
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="24px"
              viewBox="0 0 24 24"
              width="24px"
              fill="#1f1f1f"
            >
              <g>
                <rect fill="none" height="24" width="24" />
                <path d="M12,3.19l7,3.11V11c0,4.52-2.98,8.69-7,9.93C7.98,19.69,5,15.52,5,11V6.3L12,3.19 M12,1L3,5v6c0,5.55,3.84,10.74,9,12 c5.16-1.26,9-6.45,9-12V5L12,1L12,1z M11,7h2v2h-2V7z M11,11h2v6h-2V11z" />
              </g>
            </svg>
            <p className="text-[#4c4c4c] text-base font-medium tracking-[-0.06em]">
              Your project is automatically saved as you edit
            </p>
          </div>
          {lastSaved && (
            <div className="bg-transparent px-2.5 py-1 ml-6 sm:m-0">
              <p className="text-[#7f7f7f] text-sm font-medium">
                Saved at{" "}
                {lastSaved.toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}{" "}
                {lastSaved.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-gradient-to-br from-blue-100/45 via-transparent to-transparent">
        <div className="mx-auto px-8 py-6 min-h-[800px]">
          <div className="flex gap-[50px] sm:gap-[85px] items-start justify-between flex-wrap-reverse sm:flex-nowrap">
            {/* Left Side - Form */}
            <div className="flex-1 space-y-6">
              <div className="space-y-1">
                <h1 className="text-[28px] font-semibold text-black tracking-[-0.06em] leading-[1.4]">
                  Edit your project
                </h1>
              </div>

              <div className="space-y-4">
                {/* Project Name */}
                <div className="space-y-2">
                  <label className="text-base text-black font-normal">
                    Project name
                  </label>
                  <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 flex items-center gap-3 h-11">
                    <TextFields className="h-6 w-6 shrink-0" />
                    <Input
                      value={formData.project_name}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          project_name: e.target.value,
                        }))
                      }
                      placeholder="Snapdragon AI: Multilingual Translator"
                      className="border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
                    />
                  </div>
                </div>

                {/* Event Selection */}
                <div className="space-y-2">
                  <label className="text-base text-black font-normal">
                    Submit to Event
                  </label>
                  <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl">
                    <Select
                      value={selectedEventId}
                      onValueChange={handleEventChange}
                      disabled={isLoadingEvents}
                    >
                      <SelectTrigger className="border-0 h-11 focus:ring-0 focus:ring-offset-0">
                        <SelectValue placeholder="Select an event" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableEvents.map((event) => {
                          const now = new Date();
                          const submissionStart = new Date(
                            event.submission_time_start
                          );
                          const submissionCutoff = new Date(
                            event.submission_time_cutoff
                          );
                          const isOpen =
                            now >= submissionStart && now <= submissionCutoff;
                          const isPast = now > submissionCutoff;
                          const isFuture = now < submissionStart;
                          const noSubmissionWindow =
                            !event.submission_time_start ||
                            !event.submission_time_cutoff;

                          return (
                            <SelectItem
                              key={event.event_id}
                              value={event.event_id}
                              disabled={!isOpen}
                            >
                              <div className="flex items-center gap-2">
                                <span>{event.event_name}</span>
                                {isOpen && (
                                  <Badge className="bg-green-100 text-green-800 text-xs">
                                    Open
                                  </Badge>
                                )}
                                {isPast && (
                                  <Badge className="bg-red-100 text-red-600 text-xs">
                                    Closed
                                  </Badge>
                                )}
                                {isFuture && (
                                  <Badge className="bg-blue-100 text-blue-800 text-xs">
                                    Opens {submissionStart.toLocaleDateString()}
                                  </Badge>
                                )}
                                {noSubmissionWindow && (
                                  <Badge className="bg-gray-100 text-gray-600 text-xs">
                                    Submissions not open
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-base text-[#7f7f7f]">
                    *You can only submit to events with open submission windows
                  </p>
                </div>

                {/* Track Selection */}
                {availableTracks.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-base text-black font-normal">
                      Select tracks (Optional)
                    </label>
                    <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl p-4 space-y-3">
                      {isLoadingTracks ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                        </div>
                      ) : (
                        availableTracks.map((track) => (
                          <label
                            key={track.track_id}
                            className="flex items-start gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={selectedTrackIds.includes(track.track_id)}
                              onChange={(e) =>
                                handleTrackToggle(track.track_id, e.target.checked)
                              }
                              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <div className="flex-1">
                              <span className="text-base text-black font-medium">
                                {track.name}
                              </span>
                              {track.description && (
                                <p className="text-sm text-[#7f7f7f] mt-0.5">
                                  {track.description}
                                </p>
                              )}
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                    <p className="text-base text-[#7f7f7f]">
                      *Choose the tracks your project should compete in
                    </p>
                  </div>
                )}

                {/* Project Description */}
                <div className="space-y-2">
                  <label className="text-base text-black font-normal">
                    Project Description
                  </label>
                  <Textarea
                    value={formData.project_description}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        project_description: e.target.value,
                      }))
                    }
                    placeholder="Describe your project..."
                    rows={7}
                    className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 text-base resize-none"
                  />
                  <p className="text-base text-[#7f7f7f]">
                    *This will show under the project overview section. Markdown supported.
                  </p>
                  {formData.project_description.trim() ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setShowDescriptionPreview((prev) => !prev)
                        }
                        className="text-sm font-medium text-blue-600 hover:text-blue-700"
                      >
                        {showDescriptionPreview ? "Hide preview" : "Show preview"}
                      </button>
                      {showDescriptionPreview ? (
                        <div className="rounded-xl border border-[rgba(0,0,0,0.12)] bg-white px-3 py-3">
                          <p className="text-xs font-medium text-gray-500 mb-2">
                            Preview
                          </p>
                          <ProjectDescription
                            value={formData.project_description}
                            className="text-base"
                          />
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>

                {/* Divider */}
                <div className="border-t border-dashed border-gray-200" />

                {/* Cover Image */}
                <div className="space-y-2">
                  <label className="text-base text-black font-normal">
                    Cover image
                  </label>
                  <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 flex items-center gap-3 h-11">
                    <ImageIcon className="h-6 w-6 shrink-0" />
                    <Input
                      value={formData.cover_image_url}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          cover_image_url: e.target.value,
                        }))
                      }
                      placeholder="https://www.mentormates.ai/projects/..."
                      className="border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 text-base truncate"
                    />
                    <label className="bg-[rgba(0,0,0,0.05)] shadow-sm rounded-xl px-3 py-1 cursor-pointer shrink-0">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCoverImageUpload}
                        className="hidden"
                      />
                      <span className="text-xs text-black font-normal">
                        Upload
                      </span>
                    </label>
                  </div>
                  <p className="text-base text-[#7f7f7f]">
                    *Upload an image to showcase your project (Max 10MB)
                  </p>
                </div>

                {/* Additional Materials */}
                <div className="space-y-2">
                  <label className="text-base text-black font-normal">
                    Additional materials
                  </label>
                  <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 flex items-center gap-3 h-11">
                    <Paperclip className="h-6 w-6 shrink-0" />
                    <Input
                      value={formData.additional_materials_url}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          additional_materials_url: e.target.value,
                        }))
                      }
                      placeholder="https://www.mentormates.ai/projects/..."
                      className="border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 text-base truncate"
                    />
                    <label className="bg-[rgba(0,0,0,0.05)] shadow-sm rounded-xl px-3 py-1 cursor-pointer shrink-0">
                      <input
                        type="file"
                        onChange={handleAdditionalMaterialsUpload}
                        className="hidden"
                      />
                      <span className="text-xs text-black font-normal">
                        Upload
                      </span>
                    </label>
                  </div>
                  {extraMaterialsUrls.map((url, index) => (
                    <div key={`materials-extra-${index}`} className="flex gap-2">
                      <Input
                        value={url}
                        onChange={(e) =>
                          setExtraMaterialsUrls((prev) =>
                            prev.map((item, itemIndex) =>
                              itemIndex === index ? e.target.value : item
                            )
                          )
                        }
                        placeholder="https://..."
                        className="h-11"
                      />
                      <label className="bg-[rgba(0,0,0,0.05)] shadow-sm rounded-xl px-3 py-1 cursor-pointer shrink-0 h-11 inline-flex items-center">
                        <input
                          type="file"
                          onChange={(e) =>
                            handleAdditionalMaterialsExtraUpload(index, e)
                          }
                          className="hidden"
                        />
                        <span className="text-xs text-black font-normal">
                          Upload
                        </span>
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setExtraMaterialsUrls((prev) =>
                            prev.filter((_, itemIndex) => itemIndex !== index)
                          )
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setExtraMaterialsUrls((prev) => [...prev, ""])}
                  >
                    Add another materials link
                  </Button>
                  <p className="text-base text-[#7f7f7f]">
                    *Upload any additional documentation (Max 10MB)
                  </p>
                </div>

                {/* GitHub or Live Link */}
                <div className="space-y-2">
                  <label className="text-base text-black font-normal">
                    GitHub or live link (Optional)
                  </label>
                  <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 flex items-center gap-3 h-11">
                    <Github className="h-6 w-6 shrink-0" />
                    <Input
                      value={formData.project_url}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          project_url: e.target.value,
                        }))
                      }
                      placeholder="https://..."
                      className="border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 text-base text-[rgba(0,0,0,0.6)]"
                    />
                  </div>
                  {extraProjectUrls.map((url, index) => (
                    <div key={`project-link-extra-${index}`} className="flex gap-2">
                      <Input
                        value={url}
                        onChange={(e) =>
                          setExtraProjectUrls((prev) =>
                            prev.map((item, itemIndex) =>
                              itemIndex === index ? e.target.value : item
                            )
                          )
                        }
                        placeholder="https://..."
                        className="h-11"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setExtraProjectUrls((prev) =>
                            prev.filter((_, itemIndex) => itemIndex !== index)
                          )
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setExtraProjectUrls((prev) => [...prev, ""])}
                  >
                    Add another project link
                  </Button>
                </div>

                {/* Video Link */}
                <div className="space-y-2">
                  <label className="text-base text-black font-normal">
                    Video link (Optional)
                  </label>
                  <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 flex items-center gap-3 h-11">
                    <Youtube className="h-6 w-6 shrink-0" />
                    <Input
                      value={formData.video_url}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          video_url: e.target.value,
                        }))
                      }
                      placeholder="https://..."
                      className="border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 text-base text-[rgba(0,0,0,0.6)]"
                    />
                  </div>
                  {extraVideoUrls.map((url, index) => (
                    <div key={`video-link-extra-${index}`} className="flex gap-2">
                      <Input
                        value={url}
                        onChange={(e) =>
                          setExtraVideoUrls((prev) =>
                            prev.map((item, itemIndex) =>
                              itemIndex === index ? e.target.value : item
                            )
                          )
                        }
                        placeholder="https://..."
                        className="h-11"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setExtraVideoUrls((prev) =>
                            prev.filter((_, itemIndex) => itemIndex !== index)
                          )
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setExtraVideoUrls((prev) => [...prev, ""])}
                  >
                    Add another video link
                  </Button>
                </div>

                {/* Divider */}
                <div className="border-t border-dashed border-gray-200" />

                {/* Add Teammates */}
                <div className="space-y-2">
                  <label className="text-base text-black font-normal mb-2">
                    Add teammates (Optional)
                  </label>
                  <div className="border border-gray-200 rounded-xl">
                    <div className="pt-2 px-3 border-b border-gray-200">
                      <UserSearchWithInvite
                        allTags={participants.map((p) => p.email)}
                        onTagsChange={handleTeammatesChange}
                        initialTags={project.teammates || []}
                        projectId={projectId}
                        enableInvite={true}
                        enableMailIcon={true}
                        inputStyle="pure"
                        placeholder="Enter your teammates' emails. Press Enter or comma to add each."
                      />
                    </div>
                    {/* Team Members List */}
                    <div className="border-b last:border-b-0 border-gray-200 space-y-4 mt-3 p-3">
                      {/* Lead */}
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-gray-300 shrink-0" />
                        <div className="space-y-0">
                          <div className="flex items-center gap-1">
                            <p className="text-base font-semibold text-black">
                              {project.lead_name}
                            </p>
                            <Badge
                              variant="secondary"
                              className="bg-transparent border border-[rgba(0,0,0,0.15)] text-black rounded-full text-sm font-semibold"
                            >
                              Lead
                            </Badge>
                          </div>
                          <p className="text-base text-black">
                            {project.lead_email}
                          </p>
                        </div>
                      </div>

                      {project.teammates && project.teammates.length > 0 && (
                        <>
                          <div className="border-t border-dashed border-gray-200" />
                          {project.teammates.map((teammate, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-4 border-b last:border-b-0 border-gray-200 py-4 !m-0"
                            >
                              <div className="w-14 h-14 rounded-full bg-gray-300 shrink-0" />
                              <div className="flex-1">
                                <p className="text-base font-semibold text-black">
                                  {teammate}
                                </p>
                                <p className="text-base text-black">
                                  {teammate}
                                </p>
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
              <div className="space-y-3 flex flex-col justify-center">
                <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl overflow-hidden w-full sm:w-[339px]">
                  {/* Cover Image */}
                  <div className="aspect-[339/220] relative">
                    {formData.cover_image_url ? (
                      <img
                        src={formData.cover_image_url}
                        alt="Cover"
                        className="w-full h-full object-cover"
                      />
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
                          <Badge
                            variant="secondary"
                            className="bg-white border border-[rgba(0,0,0,0.15)] text-black rounded-full text-sm"
                          >
                            <Loader2 className="h-4.5 w-4.5 mr-1" />
                            Public
                          </Badge>
                          <Badge
                            variant="secondary"
                            className="bg-white border border-[rgba(0,0,0,0.15)] text-black rounded-full text-sm"
                          >
                            Owner
                          </Badge>
                        </div>
                        <p className="text-base text-black line-clamp-2">
                          {formData.project_description ||
                            "Join the community and enter weekly raffles for free conference tickets and VIP upgrades, plus free credits for top AI and SaaS tools."}
                        </p>
                      </div>

                      {/* Metadata */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-5 w-5 text-[#575d65]" />
                          <span className="text-sm text-[#575d65]">
                            11 Jan 2025
                          </span>
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
                          <div
                            key={i}
                            className="w-10 h-10 rounded-full bg-gray-300 border-2 border-white"
                          />
                        ))}
                      </div>
                      <MoreHorizontal className="h-6 w-6 text-[#7f7f7f]" />
                    </div>
                  </div>
                </div>

                <button
                  onClick={() =>
                    window.open(
                      `/projects/${projectId}`,
                      "_blank",
                      "noopener,noreferrer"
                    )
                  }
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              project
              <strong> &quot;{project?.project_name}&quot;</strong> and all
              associated data.
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
    </>
  );
}
