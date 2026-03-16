"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { useAdmin } from "@/lib/hooks/use-admin";
import {
  EventDetails,
  EventSubmissionField,
  EventVisibility,
} from "@/lib/types";
import { useProjectSubmissionData } from "@/features/projects/components/forms/hooks/useProjectSubmissionData";
import { Public } from "@mui/icons-material";
import { submissionFieldTypeSchema } from "@/features/projects/utils/submission";
import { createProjectSubmissionPublishSchema } from "@/features/projects/components/forms/schema/ProjectSubmissionSchema";
import { ParticipantIntakeDialog } from "@/features/intake-forms/components/ParticipantIntakeDialog";
import { ProjectSubmissionFormEngine } from "@/features/projects/components/forms/components/ProjectSubmissionFormEngine";
import type {
  IntakeFormAnswers,
  IntakeFormSchema,
} from "@/features/intake-forms/types";

interface EventParticipant {
  user_id: string;
  display_name: string;
  email: string;
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
interface ActiveIntakeForm {
  formVersionId: string;
  schema: IntakeFormSchema;
}

type PublishPayload = {
  projectId: string | null;
  projectName: string;
  leadName: string;
  leadEmail: string;
  projectDescription: string;
  teammates: string[];
  projectUrl: string | null;
  coverImageUrl: string | null;
  additionalMaterialsUrl: string | null;
  eventId?: string;
  trackIds: string[];
  videoUrl: string | null;
  artifacts: Array<{
    kind: "project_link" | "video_link" | "additional_material";
    label: string;
    url: string;
    sort_order: number;
    is_primary: boolean;
  }>;
  submissionAnswers: Array<{
    eventSubmissionFieldId: string;
    answer: string | string[];
  }>;
};

type SubmissionAnswerPayloadItem = PublishPayload["submissionAnswers"][number];

export function NewProjectSubmissionFormSinglePage({
  userEmail,
  leadName,
  eventId,
  onProjectSubmitted,
  onContextusLinked,
  contextusId: initialContextusId,
}: {
  userEmail?: string;
  leadName?: string;
  eventId?: string;
  onProjectSubmitted?: () => void;
  onContextusLinked?: (ctxId: string) => void;
  contextusId?: string | null;
}) {
  const router = useRouter();
  const isAdmin = useAdmin();

  // Ref to track if draft creation has been attempted
  const draftCreationAttempted = useRef(false);

  // State
  const [projectId, setProjectId] = useState<string | null>(null);
  const [contextusId, setContextusId] = useState<string | null>(
    initialContextusId ?? null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [eventDetails, setEventDetails] = useState<EventDetails | null>(null);
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<EventVisibility>(
    EventVisibility.Public,
  );
  const [showVisibilityDropdown, setShowVisibilityDropdown] = useState(false);
  const [isDeletingDraft, setIsDeletingDraft] = useState(false);
  const [extraProjectUrls, setExtraProjectUrls] = useState<string[]>([]);
  const [extraVideoUrls, setExtraVideoUrls] = useState<string[]>([]);
  const [extraMaterialsUrls, setExtraMaterialsUrls] = useState<string[]>([]);
  const [submissionFields, setSubmissionFields] = useState<
    EventSubmissionField[]
  >([]);
  const [showDescriptionPreview, setShowDescriptionPreview] = useState(false);
  const [submissionAnswers, setSubmissionAnswers] = useState<
    Record<string, SubmissionAnswerValue>
  >({});
  const [activeIntakeForm, setActiveIntakeForm] =
    useState<ActiveIntakeForm | null>(null);
  const [showIntakeDialog, setShowIntakeDialog] = useState(false);
  const [pendingPublishPayload, setPendingPublishPayload] =
    useState<PublishPayload | null>(null);

  // Load available tracks for the event (if any)
  const { availableTracks } = useProjectSubmissionData(eventId);

  // Form state
  const [formData, setFormData] = useState({
    projectName: "",
    leadName: leadName || "",
    leadEmail: userEmail || "",
    projectDescription: "",
    teammates: [] as string[],
    projectUrl: "",
    videoUrl: "",
    coverImageUrl: "",
    additionalMaterialsUrl: "",
  });

  useEffect(() => {
    const init = async () => {
      // Hydrate from session if no props provided
      if (!leadName || !userEmail) {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const email = session?.user?.email || "";
          const nameFromMeta = (session?.user?.user_metadata?.full_name ||
            session?.user?.user_metadata?.name) as string | undefined;

          if (email && !formData.leadEmail) {
            setFormData((prev) => ({ ...prev, leadEmail: email }));
          }

          let displayName = nameFromMeta || "";
          if (session?.user?.id) {
            const { data: profile } = await supabase
              .from("user_profiles")
              .select("display_name")
              .eq("uid", session.user.id)
              .maybeSingle();
            if (profile?.display_name) displayName = profile.display_name;
          }

          if (displayName && !formData.leadName) {
            setFormData((prev) => ({ ...prev, leadName: displayName }));
          }
        } catch {
          // Silent fail
        }
      }

      // Fetch event details
      if (eventId && !eventDetails) {
        try {
          const { data, error } = await supabase
            .from("events")
            .select(
              "event_id, event_name, slug, event_date, location, cover_image_url, paid, event_description",
            )
            .eq("event_id", eventId)
            .single();

          if (!error && data) {
            setEventDetails(data as EventDetails);
          }
        } catch {
          // Silent fail
        }
      }

      setIsLoading(false);
    };

    init();
  }, [eventId, leadName, userEmail]);

  // Fetch event participants
  const fetchEventParticipants = useCallback(async () => {
    if (!eventId) return;

    try {
      const response = await fetch(
        `/api/events/${eventId}/users?roles=participant&limit=500`,
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to fetch participants");
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
      // Silent fail
    }
  }, [eventId]);

  useEffect(() => {
    if (eventId) {
      fetchEventParticipants();
    }
  }, [eventId, fetchEventParticipants]);

  useEffect(() => {
    const fetchSubmissionFields = async () => {
      if (!eventId) return;
      try {
        const response = await fetch(
          `/api/events/${eventId}/submission-fields`,
        );
        if (!response.ok) return;
        const json = (await response.json()) as {
          fields?: EventSubmissionField[];
        };
        setSubmissionFields(
          (json.fields || [])
            .filter((field) => field.is_active)
            .sort((a, b) => a.sort_order - b.sort_order),
        );
      } catch {
        // Non-blocking
      }
    };

    fetchSubmissionFields();
  }, [eventId]);

  const buildArtifactsPayload = useCallback(() => {
    const hasField = (key: string) =>
      submissionFields.length === 0 ||
      submissionFields.some((field) => field.key === key);

    const artifacts: Array<{
      kind: "project_link" | "video_link" | "additional_material";
      label: string;
      url: string;
      sort_order: number;
      is_primary: boolean;
    }> = [];

    const appendArtifacts = (
      kind: "project_link" | "video_link" | "additional_material",
      primaryUrl: string,
      extras: string[],
      baseLabel: string,
    ) => {
      const urls = [primaryUrl, ...extras]
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      urls.forEach((url, index) => {
        artifacts.push({
          kind,
          label: index === 0 ? baseLabel : `${baseLabel} ${index + 1}`,
          url,
          sort_order: index,
          is_primary: index === 0,
        });
      });
    };

    appendArtifacts(
      "project_link",
      hasField("project_url") ? formData.projectUrl : "",
      hasField("project_url") ? extraProjectUrls : [],
      "Project Link",
    );
    appendArtifacts(
      "video_link",
      hasField("video_url") ? formData.videoUrl : "",
      hasField("video_url") ? extraVideoUrls : [],
      "Video Link",
    );
    appendArtifacts(
      "additional_material",
      hasField("additional_materials") ? formData.additionalMaterialsUrl : "",
      hasField("additional_materials") ? extraMaterialsUrls : [],
      "Additional Material",
    );

    return artifacts;
  }, [
    formData.projectUrl,
    formData.videoUrl,
    formData.additionalMaterialsUrl,
    extraProjectUrls,
    extraVideoUrls,
    extraMaterialsUrls,
    submissionFields,
  ]);

  const buildSubmissionAnswersPayload =
    useCallback((): SubmissionAnswerPayloadItem[] => {
      const answers: SubmissionAnswerPayloadItem[] = [];

      for (const field of submissionFields) {
        if (BUILT_IN_SUBMISSION_FIELD_KEYS.has(field.key)) {
          continue;
        }

        const fieldType = submissionFieldTypeSchema.safeParse(field.field_type)
          .success
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
          continue;
        }

        const textValue = typeof value === "string" ? value.trim() : "";
        if (textValue.length > 0) {
          answers.push({ eventSubmissionFieldId: field.id, answer: textValue });
        }
      }

      return answers;
    }, [submissionAnswers, submissionFields]);

  // Create a draft as soon as user starts typing (only once)
  useEffect(() => {
    const hasContent =
      formData.projectName.trim() ||
      formData.projectDescription.trim() ||
      formData.projectUrl.trim();

    // Skip if no content, already have a projectId, or already attempted to create a draft
    if (!hasContent || projectId || draftCreationAttempted.current) return;

    const createDraft = async () => {
      // Mark that we've attempted to create a draft
      draftCreationAttempted.current = true;

      try {
        const resp = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId,
            leadName: formData.leadName,
            leadEmail: formData.leadEmail,
            contextus: isAdmin,
          }),
        });
        if (resp.ok) {
          const json = await resp.json();
          setProjectId(json.id);
          if (json.contextus_project_id && onContextusLinked && isAdmin) {
            setContextusId(json.contextus_project_id as string);
            onContextusLinked?.(json.contextus_project_id as string);
          }
        } else {
          // Reset the flag if the request failed so it can be retried
          draftCreationAttempted.current = false;
        }
      } catch (e) {
        // Reset the flag if there was an error so it can be retried
        draftCreationAttempted.current = false;
      }
    };

    createDraft();
  }, [
    formData.projectName,
    formData.projectDescription,
    formData.projectUrl,
    projectId,
    eventId,
    formData.leadName,
    formData.leadEmail,
    onContextusLinked,
    isAdmin,
  ]);

  // Auto-save functionality with debounce
  useEffect(() => {
    if (!projectId || isLoading) return;

    const timer = setTimeout(() => {
      handleAutoSave();
    }, 2000);

    return () => clearTimeout(timer);
  }, [
    formData,
    projectId,
    isLoading,
    extraProjectUrls,
    extraVideoUrls,
    extraMaterialsUrls,
    submissionAnswers,
    submissionFields,
  ]);

  const handleAutoSave = async () => {
    if (!projectId || isLoading || isSaving) return;

    const hasField = (key: string) =>
      submissionFields.length === 0 ||
      submissionFields.some((field) => field.key === key);

    setIsSaving(true);
    try {
      // Filter out invited users (those not in the participants list)
      // Only save teammates who are actual event participants
      const participantEmails = participants.map((p) => p.email.toLowerCase());
      const validTeammates = formData.teammates.filter((email) =>
        participantEmails.includes(email.toLowerCase()),
      );

      const payload: Record<string, unknown> = {
        project_name: formData.projectName.trim() || undefined,
        project_description: formData.projectDescription.trim() || undefined,
        project_url: hasField("project_url")
          ? formData.projectUrl.trim() || null
          : null,
        video_url: hasField("video_url")
          ? formData.videoUrl.trim() || null
          : null,
        cover_image_url: hasField("cover_image")
          ? formData.coverImageUrl.trim() || null
          : null,
        additional_materials_url: hasField("additional_materials")
          ? formData.additionalMaterialsUrl.trim() || null
          : null,
        lead_name: formData.leadName,
        lead_email: formData.leadEmail,
        teammates: validTeammates,
        artifacts: buildArtifactsPayload(),
        submission_answers: buildSubmissionAnswersPayload(),
      };

      const resp = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (resp.ok) {
        setLastSaved(new Date());
      }
    } catch (e) {
      // Silent failure
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

      setFormData((prev) => ({ ...prev, coverImageUrl: publicUrl }));

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

    setFormData((prev) => ({ ...prev, additionalMaterialsUrl: publicUrl }));

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

  const handleTrackToggle = (trackId: string, checked: boolean) => {
    setSelectedTrackIds((prev) =>
      checked ? [...prev, trackId] : prev.filter((id) => id !== trackId),
    );
  };

  const handleTeammatesChange = async (tags: string[]) => {
    // Extract emails from tags that might be in "Name (email)" format
    const emails = tags.map((tag) => {
      const emailMatch = tag.match(/\((.+?)\)$/);
      return emailMatch ? emailMatch[1] : tag;
    });
    setFormData((prev) => ({ ...prev, teammates: emails }));
  };

  // Submit
  const handlePublish = async () => {
    setIsSubmitting(true);

    const validation = createProjectSubmissionPublishSchema(
      submissionFields,
    ).safeParse({
      projectName: formData.projectName,
      projectDescription: formData.projectDescription,
      projectUrl: formData.projectUrl,
      videoUrl: formData.videoUrl,
      coverImageUrl: formData.coverImageUrl,
      additionalMaterialsUrl: formData.additionalMaterialsUrl,
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
      setIsSubmitting(false);
      return;
    }

    try {
      const hasField = (key: string) =>
        submissionFields.length === 0 ||
        submissionFields.some((field) => field.key === key);

      // Filter out invited users (those not in the participants list)
      // Only submit teammates who are actual event participants
      const participantEmails = participants.map((p) => p.email.toLowerCase());
      const validTeammates = formData.teammates.filter((email) =>
        participantEmails.includes(email.toLowerCase()),
      );

      const payload = {
        projectId,
        projectName: formData.projectName,
        leadName: formData.leadName,
        leadEmail: formData.leadEmail,
        projectDescription: formData.projectDescription,
        teammates: validTeammates,
        projectUrl: hasField("project_url") ? formData.projectUrl : null,
        coverImageUrl: hasField("cover_image") ? formData.coverImageUrl : null,
        additionalMaterialsUrl: hasField("additional_materials")
          ? formData.additionalMaterialsUrl
          : null,
        eventId,
        trackIds: selectedTrackIds,
        videoUrl: hasField("video_url") ? formData.videoUrl : null,
        artifacts: buildArtifactsPayload(),
        submissionAnswers: buildSubmissionAnswersPayload(),
      };

      if (eventId) {
        const intakeResponse = await fetch(
          `/api/events/${eventId}/intake-form?context=project_submission`,
          { cache: "no-store" },
        );
        if (intakeResponse.ok) {
          const intakeData = (await intakeResponse.json()) as {
            form: ActiveIntakeForm | null;
          };
          if (intakeData.form?.formVersionId && intakeData.form.schema) {
            setActiveIntakeForm(intakeData.form);
            setPendingPublishPayload(payload);
            setShowIntakeDialog(true);
            setIsSubmitting(false);
            return;
          }
        }
      }

      const response = await fetch("/api/projects/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit project");
      }

      const data = await response.json();
      const warning = data.warning;
      if (warning) {
        toast({
          title: "Warning",
          description: warning,
          variant: "destructive",
        });
      }

      toast({
        title: "Project Successfully Shared!",
        description:
          "Your project is now available for others to view and provide feedback.",
      });
      onProjectSubmitted?.();
      router.push(`/projects/${data.data?.id || data.id}`);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "There was an error sharing your project.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleIntakeSubmit = async (answers: IntakeFormAnswers) => {
    if (!pendingPublishPayload) {
      toast({
        title: "Error",
        description: "Missing project submission payload.",
        variant: "destructive",
      });
      return;
    }

    if (!eventId || !activeIntakeForm?.formVersionId) {
      toast({
        title: "Error",
        description: "Missing intake form metadata.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const projectResponse = await fetch("/api/projects/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingPublishPayload),
      });

      if (!projectResponse.ok) {
        const errorData = await projectResponse.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to submit project");
      }

      const projectData = await projectResponse.json();
      const submittedProjectId = projectData.data?.id || projectData.id;

      const intakeResponse = await fetch(
        `/api/events/${eventId}/intake-form/submissions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            context: "project_submission",
            formVersionId: activeIntakeForm.formVersionId,
            projectId: submittedProjectId,
            answers,
          }),
        },
      );

      if (!intakeResponse.ok) {
        const intakeError = await intakeResponse.json().catch(() => ({}));
        throw new Error(intakeError.error || "Failed to submit intake form");
      }

      toast({
        title: "Project Successfully Shared!",
        description:
          "Your project and intake form have been submitted successfully.",
      });
      onProjectSubmitted?.();
      setShowIntakeDialog(false);
      setPendingPublishPayload(null);
      router.push(`/projects/${submittedProjectId}`);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "There was an error sharing your project.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDraft = async () => {
    setIsDeletingDraft(true);
    if (!projectId) {
      toast({
        title: "Draft project deleted",
        description: "Draft project has been deleted.",
      });
      router.push(
        eventDetails?.slug
          ? `/events/${eventDetails.slug}/overview`
          : eventId
            ? `/events/${eventId}/overview`
            : `/projects`,
      );
      setIsDeletingDraft(false);
      return;
    }
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete draft");
      }
      toast({
        title: "Draft project deleted",
        description: "Draft project has been deleted.",
      });
      router.push(
        eventDetails?.slug
          ? `/events/${eventDetails.slug}/overview`
          : eventId
            ? `/events/${eventId}/overview`
            : `/projects`,
      );
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to delete draft",
        variant: "destructive",
      });
    } finally {
      setIsDeletingDraft(false);
    }
  };

  const handlePreviewClick = useCallback(() => {
    // If no project has been created/saved yet, do not navigate
    if (!projectId) {
      toast({
        title: "Preview unavailable",
        description:
          "Start filling out the form to create a draft. The preview will be available once a draft is created.",
        variant: "destructive",
      });
      return;
    }

    // Open the project preview in a new tab
    window.open(`/projects/${projectId}`, "_blank", "noopener,noreferrer");
  }, [projectId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-blue-400 h-10 w-10" />
      </div>
    );
  }

  const totalMembers = (formData.teammates?.length || 0) + 1;

  return (
    <div className="bg-white mb-8">
      <Toaster />
      {activeIntakeForm ? (
        <ParticipantIntakeDialog
          open={showIntakeDialog}
          schema={activeIntakeForm.schema}
          submitting={isSubmitting}
          onClose={() => {
            setShowIntakeDialog(false);
            setPendingPublishPayload(null);
          }}
          onSubmit={handleIntakeSubmit}
        />
      ) : null}

      {/* Sticky Auto-save Banner */}
      <div className="sticky top-0 z-20 bg-sky-50 border-b border-[#d8d8d8]">
        <div className="px-6 py-3.5 flex items-center justify-between flex-wrap">
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

      <div className="overflow-visible">
        <div className="bg-gradient-to-br from-blue-100/45 via-transparent to-transparent">
          <ProjectSubmissionFormEngine
            title="Create your project"
            description="Start building your project with automatic saving as you go. Share when you're ready!"
            toolbarLeading={
              <div className="relative">
                <button
                  onClick={() =>
                    setShowVisibilityDropdown(!showVisibilityDropdown)
                  }
                  className="flex items-center gap-2 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] px-3 py-2 h-[44px] w-[142px] hover:bg-gray-50 transition-colors"
                >
                  <Public className="w-6 h-6" />
                  <span className="text-[16px] font-normal">
                    {visibility.charAt(0).toUpperCase() + visibility.slice(1)}
                  </span>
                  <svg
                    className="w-6 h-6 ml-auto"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M7 10l5 5 5-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                {showVisibilityDropdown && (
                  <div className="absolute top-full py-1.5 px-1 mt-2 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] shadow-lg z-10 w-[160px] overflow-hidden">
                    {[EventVisibility.Public, EventVisibility.Private].map(
                      (vis) => (
                        <button
                          key={vis}
                          onClick={() => {
                            setVisibility(vis);
                            setShowVisibilityDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-[#F2F2F2] text-[16px] rounded-[8px]"
                        >
                          {vis.charAt(0).toUpperCase() + vis.slice(1)}
                        </button>
                      ),
                    )}
                  </div>
                )}
              </div>
            }
            actions={
              <>
                <Button
                  variant="secondary"
                  onClick={() =>
                    router.push(
                      eventDetails?.slug
                        ? `/events/${eventDetails.slug}/overview`
                        : eventId
                          ? `/events/${eventId}/overview`
                          : `/projects`,
                    )
                  }
                  className="bg-[#f2f2f2] hover:bg-[#e8e8e8] text-black rounded-xl px-6 py-2.5 shadow-sm font-medium"
                >
                  Save draft and exit
                </Button>
                <Button
                  onClick={handleDeleteDraft}
                  disabled={isDeletingDraft}
                  className="bg-red-600 hover:bg-red-700 text-white rounded-xl px-6 py-2.5 shadow-sm font-medium"
                >
                  Delete draft
                </Button>
                <Button
                  onClick={handlePublish}
                  disabled={isSubmitting}
                  className="bg-[#4b89ef] hover:bg-[#3d75d9] text-white rounded-xl px-6 py-2.5 shadow-sm font-medium"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    "Publish project"
                  )}
                </Button>
              </>
            }
            formData={formData}
            onFormDataChange={(updates) =>
              setFormData((prev) => ({ ...prev, ...updates }))
            }
            tracks={availableTracks.map((track) => ({
              id: track.id,
              name: track.name,
            }))}
            selectedTrackIds={selectedTrackIds}
            onTrackToggle={handleTrackToggle}
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
            teammateTagOptions={participants.map((p) =>
              p.display_name && p.display_name !== p.email
                ? `${p.display_name} (${p.email})`
                : p.email,
            )}
            teammateInitialTags={formData.teammates.map((email) => {
              const participant = participants.find((p) => p.email === email);
              return participant?.display_name &&
                participant.display_name !== email
                ? `${participant.display_name} (${email})`
                : email;
            })}
            onTeammatesChange={handleTeammatesChange}
            projectId={projectId || undefined}
            previewStatusBadge={
              <Badge
                variant="secondary"
                className="bg-white border border-[rgba(0,0,0,0.15)] text-black rounded-full text-sm"
              >
                Draft
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
            previewDateText={new Date().toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            totalMembers={totalMembers}
            onPreviewClick={handlePreviewClick}
            previewEnabled={Boolean(projectId)}
            previewDisabledTitle={
              projectId
                ? "Open project preview in a new tab"
                : "Preview available after draft is created"
            }
            eventDetails={eventDetails}
            eventHref={
              eventDetails
                ? `/events/${eventDetails.event_id}/overview`
                : undefined
            }
            showCalendarClock={true}
          />
        </div>
      </div>
    </div>
  );
}
