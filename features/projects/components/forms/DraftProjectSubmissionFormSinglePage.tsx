"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2 } from "lucide-react";
import { Session } from "@supabase/supabase-js";
import { toast } from "@/lib/hooks/use-toast";
import { EventSubmissionField, Project } from "@/lib/types";
import { updateProjectTeamClient } from "@/features/projects/client-actions/client-update";
import { deleteProjectClient } from "@/features/projects/client-actions/client-delete";
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
import { ParticipantIntakeDialog } from "@/features/intake-forms/components/ParticipantIntakeDialog";
import { ProjectSubmissionFormEngine } from "@/features/projects/components/forms/components/ProjectSubmissionFormEngine";
import {
  buildDraftArtifactsPayload,
  hasDraftUrlListChanged,
  normalizeDraftUrls,
  splitPrimaryAndExtrasFromArtifacts,
} from "@/features/projects/components/forms/utils/draftProjectArtifacts";
import { submissionFieldTypeSchema } from "@/features/projects/utils/submission";
import { createProjectSubmissionPublishSchema } from "@/features/projects/components/forms/schema/ProjectSubmissionSchema";
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

type SubmissionAnswerValue = string | string[];
const BUILT_IN_SUBMISSION_FIELD_KEYS = new Set([
  "project_name",
  "project_description",
  "project_url",
  "video_url",
  "cover_image",
  "additional_materials",
]);
type SubmissionAnswerPayloadItem = {
  eventSubmissionFieldId: string;
  answer: string | string[];
};

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
  const [submissionFields, setSubmissionFields] = useState<
    EventSubmissionField[]
  >([]);
  const [submissionAnswers, setSubmissionAnswers] = useState<
    Record<string, SubmissionAnswerValue>
  >(() =>
    Object.fromEntries(
      (initialProject.submission_answers || []).map((answer) => [
        answer.event_submission_field_id,
        answer.answer,
      ]),
    ),
  );

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
    [],
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
    initialProject.event_id,
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
        `,
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
          return event;
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
            new Date(b.event_date).getTime() - new Date(a.event_date).getTime(),
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
        `/api/events/${project.event_id}/users?roles=participant&limit=500`,
      );
      const payload = await response.json();
      if (!response.ok) {
        return;
      }

      const participantList: EventParticipant[] = (payload.users || [])
        .filter((user: { email: string }) => Boolean(user.email))
        .map(
          (user: { user_id: string; display_name: string; email: string }) => ({
            user_id: user.user_id,
            display_name: user.display_name || user.email || "",
            email: user.email || "",
          }),
        );

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
    const hasField = (key: string) =>
      submissionFields.length === 0 ||
      submissionFields.some((field) => field.key === key);

    return buildDraftArtifactsPayload({
      projectUrl: hasField("project_url") ? formData.project_url : "",
      videoUrl: hasField("video_url") ? formData.video_url : "",
      additionalMaterialsUrl: hasField("additional_materials")
        ? formData.additional_materials_url
        : "",
      extraProjectUrls: hasField("project_url") ? extraProjectUrls : [],
      extraVideoUrls: hasField("video_url") ? extraVideoUrls : [],
      extraMaterialsUrls: hasField("additional_materials")
        ? extraMaterialsUrls
        : [],
    });
  }, [
    formData.project_url,
    formData.video_url,
    formData.additional_materials_url,
    extraProjectUrls,
    extraVideoUrls,
    extraMaterialsUrls,
    submissionFields,
  ]);

  const buildSubmissionAnswersPayload =
    useCallback((): SubmissionAnswerPayloadItem[] => {
      return submissionFields.reduce<SubmissionAnswerPayloadItem[]>(
        (answers, field) => {
          if (BUILT_IN_SUBMISSION_FIELD_KEYS.has(field.key)) {
            return answers;
          }

          const fieldType = submissionFieldTypeSchema.safeParse(
            field.field_type,
          ).success
            ? field.field_type
            : "short_text";
          const value = submissionAnswers[field.id];

          if (fieldType === "multi_url") {
            const urls = (Array.isArray(value) ? value : [])
              .map((url) => (typeof url === "string" ? url.trim() : ""))
              .filter((url) => url.length > 0);

            if (urls.length > 0) {
              answers.push({ eventSubmissionFieldId: field.id, answer: urls });
            }

            return answers;
          }

          const textValue = typeof value === "string" ? value.trim() : "";
          if (textValue.length > 0) {
            answers.push({
              eventSubmissionFieldId: field.id,
              answer: textValue,
            });
          }

          return answers;
        },
        [],
      );
    }, [submissionAnswers, submissionFields]);

  const getSavedSubmissionAnswersPayload =
    useCallback((): SubmissionAnswerPayloadItem[] => {
      return submissionFields.reduce<SubmissionAnswerPayloadItem[]>(
        (answers, field) => {
          const existingAnswer = project.submission_answers?.find(
            (answer) => answer.event_submission_field_id === field.id,
          );

          if (!existingAnswer) {
            return answers;
          }

          if (Array.isArray(existingAnswer.answer)) {
            const urls = existingAnswer.answer
              .map((url) => (typeof url === "string" ? url.trim() : ""))
              .filter((url) => url.length > 0);

            if (urls.length > 0) {
              answers.push({ eventSubmissionFieldId: field.id, answer: urls });
            }

            return answers;
          }

          const textValue =
            typeof existingAnswer.answer === "string"
              ? existingAnswer.answer.trim()
              : "";

          if (textValue.length > 0) {
            answers.push({
              eventSubmissionFieldId: field.id,
              answer: textValue,
            });
          }

          return answers;
        },
        [],
      );
    }, [project.submission_answers, submissionFields]);

  // Effects
  useEffect(() => {
    if (project?.event_id) {
      fetchEventParticipants();
      setSelectedEventId(project.event_id);
      fetchEventTracks(project.event_id);
      fetchProjectTracks();
    }
  }, [
    project?.event_id,
    fetchEventParticipants,
    fetchEventTracks,
    fetchProjectTracks,
  ]);

  useEffect(() => {
    const fetchArtifactByKind = async (
      kind: "project_link" | "video_link" | "additional_material",
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
    const fetchSubmissionFields = async () => {
      if (!project.event_id) {
        setSubmissionFields([]);
        return;
      }

      try {
        const response = await fetch(
          `/api/events/${project.event_id}/submission-fields`,
        );
        if (!response.ok) {
          setSubmissionFields([]);
          return;
        }

        const json = (await response.json()) as {
          fields?: EventSubmissionField[];
        };
        setSubmissionFields(
          (json.fields || [])
            .filter((field) => field.is_active)
            .sort((a, b) => a.sort_order - b.sort_order),
        );
      } catch {
        setSubmissionFields([]);
      }
    };

    fetchSubmissionFields();
  }, [project.event_id]);

  useEffect(() => {
    const fetchSubmissionAnswers = async () => {
      try {
        const { data, error } = await supabase
          .from("project_submission_answers")
          .select("event_submission_field_id, answer")
          .eq("project_id", projectId);

        if (error) {
          return;
        }

        setSubmissionAnswers(
          Object.fromEntries(
            (data || []).map((answer) => [
              answer.event_submission_field_id,
              answer.answer as SubmissionAnswerValue,
            ]),
          ),
        );
      } catch {
        // Silent fail; form stays editable without answers.
      }
    };

    fetchSubmissionAnswers();
  }, [projectId]);

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
  }, [
    formData,
    extraProjectUrls,
    extraVideoUrls,
    extraMaterialsUrls,
    submissionAnswers,
    submissionFields,
  ]);

  const handleAutoSave = async () => {
    if (isSaving) return;

    const hasField = (key: string) =>
      submissionFields.length === 0 ||
      submissionFields.some((field) => field.key === key);

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
      hasDraftUrlListChanged(extraMaterialsUrls, savedExtraMaterialsUrls) ||
      JSON.stringify(buildSubmissionAnswersPayload()) !==
        JSON.stringify(getSavedSubmissionAnswersPayload());

    if (!hasChanges) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_name: formData.project_name.trim() || undefined,
          project_description: formData.project_description.trim() || undefined,
          project_url: hasField("project_url")
            ? formData.project_url.trim() || null
            : null,
          video_url: hasField("video_url")
            ? formData.video_url.trim() || null
            : null,
          cover_image_url: hasField("cover_image")
            ? formData.cover_image_url.trim() || null
            : null,
          additional_materials_url: hasField("additional_materials")
            ? formData.additional_materials_url.trim() || null
            : null,
          extra_project_urls: hasField("project_url")
            ? normalizeDraftUrls(extraProjectUrls)
            : [],
          extra_video_urls: hasField("video_url")
            ? normalizeDraftUrls(extraVideoUrls)
            : [],
          extra_materials_urls: hasField("additional_materials")
            ? normalizeDraftUrls(extraMaterialsUrls)
            : [],
          artifacts: buildArtifactsPayload(),
          submission_answers: buildSubmissionAnswersPayload(),
        }),
      });

      if (response.ok) {
        const json = (await response.json()) as { project?: Project };
        if (json.project) {
          setProject({
            ...json.project,
            submission_answers: buildSubmissionAnswersPayload().map(
              (answer) => ({
                id:
                  project.submission_answers?.find(
                    (saved) =>
                      saved.event_submission_field_id ===
                      answer.eventSubmissionFieldId,
                  )?.id || "",
                project_id: projectId,
                event_submission_field_id: answer.eventSubmissionFieldId,
                answer: answer.answer,
              }),
            ),
          });
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
    e: React.ChangeEvent<HTMLInputElement>,
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
    e: React.ChangeEvent<HTMLInputElement>,
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
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const input = e.currentTarget;
    const file = e.target.files?.[0];
    if (!file) return;

    const publicUrl = await uploadAdditionalMaterialFile(file);
    input.value = "";
    if (!publicUrl) return;

    setExtraMaterialsUrls((prev) =>
      prev.map((item, itemIndex) => (itemIndex === index ? publicUrl : item)),
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
        (email) => email.toLowerCase() !== project.lead_email?.toLowerCase(),
      );

      const { data } = await updateProjectTeamClient(projectId, validEmails);

      if (data) {
        setProject({ ...data, submission_answers: project.submission_answers });
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
        (email) => email !== teammateEmail,
      );
      const { data } = await updateProjectTeamClient(
        projectId,
        updatedTeammates,
      );

      if (data) {
        setProject({ ...data, submission_answers: project.submission_answers });
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
      (e) => e.event_id === newEventId,
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
        body: JSON.stringify({ event_id: newEventId, submission_answers: [] }),
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
      setProject({
        ...project,
        event_id: newEventId,
        submission_answers: [],
      });
      setSubmissionAnswers({});

      toast({
        title: "Event Updated",
        description: `Project moved to "${selectedEvent.event_name}"`,
      });

      // Refresh participants and tracks for new event
      fetchEventParticipants();
      fetchEventTracks(newEventId);

      await supabase
        .from("project_tracks")
        .delete()
        .eq("project_id", projectId);

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
    const hasField = (key: string) =>
      submissionFields.length === 0 ||
      submissionFields.some((field) => field.key === key);

    const response = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_name: formData.project_name.trim() || undefined,
        project_description: formData.project_description.trim() || undefined,
        project_url: hasField("project_url")
          ? formData.project_url.trim() || null
          : null,
        video_url: hasField("video_url")
          ? formData.video_url.trim() || null
          : null,
        cover_image_url: hasField("cover_image")
          ? formData.cover_image_url.trim() || null
          : null,
        additional_materials_url: hasField("additional_materials")
          ? formData.additional_materials_url.trim() || null
          : null,
        extra_project_urls: hasField("project_url")
          ? normalizeDraftUrls(extraProjectUrls)
          : [],
        extra_video_urls: hasField("video_url")
          ? normalizeDraftUrls(extraVideoUrls)
          : [],
        extra_materials_urls: hasField("additional_materials")
          ? normalizeDraftUrls(extraMaterialsUrls)
          : [],
        artifacts: buildArtifactsPayload(),
        submission_answers: buildSubmissionAnswersPayload(),
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
    const validation = createProjectSubmissionPublishSchema(
      submissionFields,
    ).safeParse({
      projectName: formData.project_name,
      projectDescription: formData.project_description,
      projectUrl: formData.project_url,
      videoUrl: formData.video_url,
      coverImageUrl: formData.cover_image_url,
      additionalMaterialsUrl: formData.additional_materials_url,
      submissionAnswers,
    });

    if (!validation.success) {
      toast({
        title: "Missing required information",
        description:
          validation.error.issues[0]?.message ||
          "Please complete the required submission fields before publishing.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (project.event_id) {
        const intakeResponse = await fetch(
          `/api/events/${project.event_id}/intake-form?context=project_submission`,
          { cache: "no-store" },
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
        setProject({
          ...data,
          submission_answers: buildSubmissionAnswersPayload().map((answer) => ({
            id:
              project.submission_answers?.find(
                (saved) =>
                  saved.event_submission_field_id ===
                  answer.eventSubmissionFieldId,
              )?.id || "",
            project_id: projectId,
            event_submission_field_id: answer.eventSubmissionFieldId,
            answer: answer.answer,
          })),
        });
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
        },
      );

      if (!intakeResponse.ok) {
        const intakeError = await intakeResponse.json().catch(() => ({}));
        throw new Error(intakeError.error || "Failed to submit intake form");
      }

      setProject({
        ...data,
        submission_answers: buildSubmissionAnswersPayload().map((answer) => ({
          id:
            project.submission_answers?.find(
              (saved) =>
                saved.event_submission_field_id ===
                answer.eventSubmissionFieldId,
            )?.id || "",
          project_id: projectId,
          event_submission_field_id: answer.eventSubmissionFieldId,
          answer: answer.answer,
        })),
      });
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

      <div className="bg-gradient-to-br from-blue-100/45 via-transparent to-transparent">
        <ProjectSubmissionFormEngine
          title="Edit your project"
          actions={
            <>
              {isLead ? (
                <Button
                  onClick={() => setShowDeleteDialog(true)}
                  className="bg-red-600 hover:bg-red-700 text-white rounded-xl px-6 py-2.5 shadow-sm font-medium"
                >
                  <Trash2 className="h-6 w-6 mr-1.5" />
                  Delete
                </Button>
              ) : null}
              <Button
                onClick={handlePublish}
                className="bg-[#4b89ef] hover:bg-[#3d75d9] text-white rounded-xl px-6 py-2.5 shadow-sm font-medium"
              >
                Publish project
              </Button>
            </>
          }
          formData={{
            projectName: formData.project_name,
            projectDescription: formData.project_description,
            teammates: project.teammates || [],
            projectUrl: formData.project_url,
            videoUrl: formData.video_url,
            coverImageUrl: formData.cover_image_url,
            additionalMaterialsUrl: formData.additional_materials_url,
          }}
          onFormDataChange={(updates) =>
            setFormData((prev) => ({
              ...prev,
              ...(updates.projectName !== undefined
                ? { project_name: updates.projectName }
                : {}),
              ...(updates.projectDescription !== undefined
                ? { project_description: updates.projectDescription }
                : {}),
              ...(updates.projectUrl !== undefined
                ? { project_url: updates.projectUrl }
                : {}),
              ...(updates.videoUrl !== undefined
                ? { video_url: updates.videoUrl }
                : {}),
              ...(updates.coverImageUrl !== undefined
                ? { cover_image_url: updates.coverImageUrl }
                : {}),
              ...(updates.additionalMaterialsUrl !== undefined
                ? { additional_materials_url: updates.additionalMaterialsUrl }
                : {}),
            }))
          }
          eventSelectionSection={
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
                        event.submission_time_start,
                      );
                      const submissionCutoff = new Date(
                        event.submission_time_cutoff,
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
                            {isOpen ? (
                              <Badge className="bg-green-100 text-green-800 text-xs">
                                Open
                              </Badge>
                            ) : null}
                            {isPast ? (
                              <Badge className="bg-red-100 text-red-600 text-xs">
                                Closed
                              </Badge>
                            ) : null}
                            {isFuture ? (
                              <Badge className="bg-blue-100 text-blue-800 text-xs">
                                Opens {submissionStart.toLocaleDateString()}
                              </Badge>
                            ) : null}
                            {noSubmissionWindow ? (
                              <Badge className="bg-gray-100 text-gray-600 text-xs">
                                Submissions not open
                              </Badge>
                            ) : null}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-base text-[#7f7f7f]">
                You can only submit to events with open submission windows.
              </p>
            </div>
          }
          tracks={availableTracks.map((track) => ({
            id: track.track_id,
            name: track.name,
            description: track.description,
          }))}
          selectedTrackIds={selectedTrackIds}
          isLoadingTracks={isLoadingTracks}
          onTrackToggle={handleTrackToggle}
          tracksLabel="Select tracks (Optional)"
          tracksHelpText="Choose the tracks your project should compete in."
          showDescriptionPreview={showDescriptionPreview}
          onToggleDescriptionPreview={() =>
            setShowDescriptionPreview((prev) => !prev)
          }
          onCoverImageUpload={handleCoverImageUpload}
          onAdditionalMaterialsUpload={handleAdditionalMaterialsUpload}
          onAdditionalMaterialsExtraUpload={
            handleAdditionalMaterialsExtraUpload
          }
          extraProjectUrls={extraProjectUrls}
          onExtraProjectUrlChange={(index, value) =>
            setExtraProjectUrls((prev) =>
              prev.map((item, itemIndex) =>
                itemIndex === index ? value : item,
              ),
            )
          }
          onAddProjectUrl={() => setExtraProjectUrls((prev) => [...prev, ""])}
          onRemoveProjectUrl={(index) =>
            setExtraProjectUrls((prev) =>
              prev.filter((_, itemIndex) => itemIndex !== index),
            )
          }
          extraVideoUrls={extraVideoUrls}
          onExtraVideoUrlChange={(index, value) =>
            setExtraVideoUrls((prev) =>
              prev.map((item, itemIndex) =>
                itemIndex === index ? value : item,
              ),
            )
          }
          onAddVideoUrl={() => setExtraVideoUrls((prev) => [...prev, ""])}
          onRemoveVideoUrl={(index) =>
            setExtraVideoUrls((prev) =>
              prev.filter((_, itemIndex) => itemIndex !== index),
            )
          }
          extraMaterialsUrls={extraMaterialsUrls}
          onExtraMaterialsUrlChange={(index, value) =>
            setExtraMaterialsUrls((prev) =>
              prev.map((item, itemIndex) =>
                itemIndex === index ? value : item,
              ),
            )
          }
          onAddMaterialsUrl={() =>
            setExtraMaterialsUrls((prev) => [...prev, ""])
          }
          onRemoveMaterialsUrl={(index) =>
            setExtraMaterialsUrls((prev) =>
              prev.filter((_, itemIndex) => itemIndex !== index),
            )
          }
          submissionFields={submissionFields}
          submissionAnswers={submissionAnswers}
          onSubmissionAnswerChange={(fieldId, value) =>
            setSubmissionAnswers((prev) => ({ ...prev, [fieldId]: value }))
          }
          teammateTagOptions={participants.map((p) => p.email)}
          teammateInitialTags={project.teammates || []}
          onTeammatesChange={handleTeammatesChange}
          projectId={projectId}
          teammateList={
            <div className="border-b last:border-b-0 border-gray-200 space-y-4 mt-3 p-3">
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
                  <p className="text-base text-black">{project.lead_email}</p>
                </div>
              </div>

              {project.teammates && project.teammates.length > 0 ? (
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
                        <p className="text-base text-black">{teammate}</p>
                      </div>
                      {isLead ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveTeammate(teammate)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </>
              ) : null}
            </div>
          }
          previewStatusBadge={
            <Badge
              variant="secondary"
              className="bg-white border border-[rgba(0,0,0,0.15)] text-black rounded-full text-sm"
            >
              <Loader2 className="h-4.5 w-4.5 mr-1" />
              Public
            </Badge>
          }
          previewRoleBadge={
            <Badge
              variant="secondary"
              className="bg-white border border-[rgba(0,0,0,0.15)] text-black rounded-full text-sm"
            >
              Owner
            </Badge>
          }
          previewDateText={new Date(project.created_at).toLocaleDateString(
            "en-US",
            {
              month: "short",
              day: "numeric",
              year: "numeric",
            },
          )}
          previewCoverFallbackClassName="bg-gradient-to-br from-orange-400 via-blue-500 to-purple-600"
          totalMembers={totalMembers}
          onPreviewClick={() =>
            window.open(
              `/projects/${projectId}`,
              "_blank",
              "noopener,noreferrer",
            )
          }
          previewEnabled={true}
          previewDisabledTitle="Open project preview in a new tab"
        />
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
