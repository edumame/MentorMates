"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  CalendarClock,
  ThumbsUp,
  MessageSquarePlus,
  MoreHorizontal,
  ExternalLink,
} from "lucide-react";
import { toast } from "@/lib/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import UserSearchWithInvite from "@/components/utils/UserSearchWithInvite";
import { useAdmin } from "@/lib/hooks/use-admin";
import {
  EventDetails,
  EventSubmissionField,
} from "@/lib/types";
import { useProjectSubmissionData } from "@/features/projects/components/forms/hooks/useProjectSubmissionData";
import { EventCard } from "@/components/events/event-card";
import { ParticipantIntakeDialog } from "@/features/intake-forms/components/ParticipantIntakeDialog";
import { ProjectPrivacySelect } from "@/features/projects/components/forms/components/ProjectPrivacySelect";
import { ProjectSubmissionSchemaSection } from "@/features/projects/components/forms/components/ProjectSubmissionSchemaSection";
import { useProjectSubmissionAutosave } from "@/features/projects/components/forms/hooks/useProjectSubmissionAutosave";
import { getProjectVisibilityDescription } from "@/features/projects/components/forms/utils/projectPrivacy";
import {
  buildEffectiveSubmissionFields,
  buildSubmissionAnswersPayload,
  type SubmissionValue,
} from "@/features/projects/utils/effectiveSubmission";
import type {
  IntakeFormAnswers,
  IntakeFormSchema,
} from "@/features/intake-forms/types";
import { CoverImageWithFallback } from "@/features/projects/components/displays/cover-image-with-fallback";

interface EventParticipant {
  user_id: string;
  display_name: string;
  email: string;
}

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
  projectUrl: string;
  coverImageUrl: string;
  additionalMaterialsUrl: string;
  private: boolean;
  eventId?: string;
  trackIds: string[];
  videoUrl: string;
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
    initialContextusId ?? null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [eventDetails, setEventDetails] = useState<EventDetails | null>(null);
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [isDeletingDraft, setIsDeletingDraft] = useState(false);
  const [extraProjectUrls, setExtraProjectUrls] = useState<string[]>([]);
  const [extraVideoUrls, setExtraVideoUrls] = useState<string[]>([]);
  const [extraMaterialsUrls, setExtraMaterialsUrls] = useState<string[]>([]);
  const [submissionFields, setSubmissionFields] = useState<EventSubmissionField[]>(
    []
  );
  const [showDescriptionPreview, setShowDescriptionPreview] = useState(false);
  const [submissionAnswers, setSubmissionAnswers] = useState<
    Record<string, SubmissionValue>
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
              "event_id, event_name, slug, event_date, location, cover_image_url, paid, event_description"
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
        `/api/events/${eventId}/users?roles=participant&limit=500`
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
          })
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
        const response = await fetch(`/api/events/${eventId}/submission-fields`);
        if (!response.ok) return;
        const json = (await response.json()) as {
          fields?: EventSubmissionField[];
        };
        setSubmissionFields(
          (json.fields || [])
            .filter((field) => field.is_active)
            .sort((a, b) => a.sort_order - b.sort_order)
        );
      } catch {
        // Non-blocking
      }
    };

    fetchSubmissionFields();
  }, [eventId]);

  const effectiveSubmissionFields = useMemo(
    () => buildEffectiveSubmissionFields(submissionFields, eventId),
    [eventId, submissionFields]
  );
  const hasConfiguredSubmissionFields = submissionFields.length > 0;

  const getSubmissionFieldValue = useCallback(
    (field: (typeof effectiveSubmissionFields)[number]): SubmissionValue => {
      switch (field.key) {
        case "project_name":
          return formData.projectName;
        case "project_description":
          return formData.projectDescription;
        case "project_url":
          return formData.projectUrl;
        case "video_url":
          return formData.videoUrl;
        case "cover_image":
          return formData.coverImageUrl;
        case "additional_materials":
          return [
            formData.additionalMaterialsUrl,
            ...extraMaterialsUrls,
          ].filter((value) => value.trim().length > 0);
        default:
          return submissionAnswers[field.id] ?? "";
      }
    },
    [
      extraMaterialsUrls,
      formData.additionalMaterialsUrl,
      formData.coverImageUrl,
      formData.projectDescription,
      formData.projectName,
      formData.projectUrl,
      formData.videoUrl,
      submissionAnswers,
    ]
  );

  const submissionFieldValues = useMemo(
    () =>
      Object.fromEntries(
        effectiveSubmissionFields.map((field) => [
          field.key,
          getSubmissionFieldValue(field),
        ])
      ) as Record<string, SubmissionValue>,
    [effectiveSubmissionFields, getSubmissionFieldValue]
  );

  const handleSubmissionFieldChange = useCallback(
    (fieldKey: string, value: SubmissionValue) => {
      switch (fieldKey) {
        case "project_name":
          setFormData((prev) => ({
            ...prev,
            projectName: typeof value === "string" ? value : value[0] || "",
          }));
          return;
        case "project_description":
          setFormData((prev) => ({
            ...prev,
            projectDescription: typeof value === "string" ? value : value[0] || "",
          }));
          return;
        case "project_url":
          setFormData((prev) => ({
            ...prev,
            projectUrl: typeof value === "string" ? value : value[0] || "",
          }));
          return;
        case "video_url":
          setFormData((prev) => ({
            ...prev,
            videoUrl: typeof value === "string" ? value : value[0] || "",
          }));
          return;
        case "cover_image":
          setFormData((prev) => ({
            ...prev,
            coverImageUrl: typeof value === "string" ? value : value[0] || "",
          }));
          return;
        case "additional_materials": {
          const urls = Array.isArray(value)
            ? value
            : value.trim().length > 0
              ? [value]
              : [];
          setFormData((prev) => ({
            ...prev,
            additionalMaterialsUrl: urls[0] || "",
          }));
          setExtraMaterialsUrls(urls.slice(1));
          return;
        }
        default: {
          const targetField = effectiveSubmissionFields.find(
            (field) => field.key === fieldKey
          );
          if (!targetField) return;
          setSubmissionAnswers((prev) => ({
            ...prev,
            [targetField.id]: value,
          }));
        }
      }
    },
    [effectiveSubmissionFields]
  );

  const buildArtifactsPayload = useCallback(() => {
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
      baseLabel: string
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
      typeof submissionFieldValues.project_url === "string"
        ? submissionFieldValues.project_url
        : "",
      extraProjectUrls,
      "Project Link"
    );
    appendArtifacts(
      "video_link",
      typeof submissionFieldValues.video_url === "string"
        ? submissionFieldValues.video_url
        : "",
      extraVideoUrls,
      "Video Link"
    );
    appendArtifacts(
      "additional_material",
      typeof submissionFieldValues.additional_materials === "string"
        ? submissionFieldValues.additional_materials
        : Array.isArray(submissionFieldValues.additional_materials)
          ? submissionFieldValues.additional_materials[0] || ""
          : "",
      extraMaterialsUrls,
      "Additional Material"
    );

    return artifacts;
  }, [
    extraProjectUrls,
    extraVideoUrls,
    extraMaterialsUrls,
    submissionFieldValues.additional_materials,
    submissionFieldValues.project_url,
    submissionFieldValues.video_url,
  ]);

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

  const participantEmails = useMemo(
    () => participants.map((participant) => participant.email.toLowerCase()),
    [participants]
  );
  const validTeammates = useMemo(
    () =>
      formData.teammates.filter((email) =>
        participantEmails.includes(email.toLowerCase())
      ),
    [formData.teammates, participantEmails]
  );

  const { lastSaved } = useProjectSubmissionAutosave({
    enabled: !isLoading,
    projectId,
    fields: effectiveSubmissionFields,
    values: submissionFieldValues,
    hasConfiguredSubmissionFields,
    artifacts: hasConfiguredSubmissionFields ? undefined : buildArtifactsPayload(),
    extraPayload: {
      lead_name: formData.leadName,
      lead_email: formData.leadEmail,
      teammates: validTeammates,
      private: isPrivate,
    },
  });

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

  const handleTrackToggle = (trackId: string, checked: boolean) => {
    setSelectedTrackIds((prev) =>
      checked ? [...prev, trackId] : prev.filter((id) => id !== trackId)
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

    if (formData.projectName.trim().length < 2) {
      toast({
        title: "Invalid Project Name",
        description: "Project name must be at least 2 characters long.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    const missingRequiredField = effectiveSubmissionFields.find((field) => {
      if (!field.required) return false;
      const value = submissionFieldValues[field.key];
      if (
        field.field_type === "multi_url" ||
        field.field_type === "multi_select"
      ) {
        return !Array.isArray(value) || value.every((url) => !url.trim());
      }
      return typeof value !== "string" || value.trim().length === 0;
    });
    if (missingRequiredField) {
      toast({
        title: "Missing required answer",
        description: `Please answer "${missingRequiredField.label}" before publishing.`,
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    try {
      // Filter out invited users (those not in the participants list)
      // Only submit teammates who are actual event participants
      const payload = {
        projectId,
        projectName: formData.projectName,
        leadName: formData.leadName,
        leadEmail: formData.leadEmail,
        projectDescription: formData.projectDescription,
        teammates: validTeammates,
        projectUrl: formData.projectUrl,
        coverImageUrl: formData.coverImageUrl,
        additionalMaterialsUrl: formData.additionalMaterialsUrl,
        private: isPrivate,
        eventId,
        trackIds: selectedTrackIds,
        videoUrl: formData.videoUrl,
        artifacts: hasConfiguredSubmissionFields ? [] : buildArtifactsPayload(),
        submissionAnswers: buildSubmissionAnswersPayload(
          effectiveSubmissionFields,
          submissionFieldValues
        ),
      };

      if (eventId) {
        const intakeResponse = await fetch(
          `/api/events/${eventId}/intake-form?context=project_submission`,
          { cache: "no-store" }
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
        description: getProjectVisibilityDescription(isPrivate),
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
        }
      );

      if (!intakeResponse.ok) {
        const intakeError = await intakeResponse.json().catch(() => ({}));
        throw new Error(intakeError.error || "Failed to submit intake form");
      }

      toast({
        title: "Project Successfully Shared!",
        description: `${getProjectVisibilityDescription(isPrivate)} Your intake form was submitted too.`,
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
            : `/projects`
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
            : `/projects`
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
    <div className="bg-white mb-8 sm:pb-0 pb-24">
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

      {/* Wrapper without top border */}
      <div className="overflow-visible">
        {/* Main Content */}
        <div className="bg-gradient-to-br from-blue-100/45 via-transparent to-transparent">
          <div className="px-8 py-6 min-h-[800px]">
            {/* TODO(lia, #660): Fix mobile layout of this top bar.
                Currently on mobile (<640px), the visibility dropdown + 3 action
                buttons wrap awkwardly with text breaking mid-word.
                Options:
                  1. Stack vertically full-width on mobile
                  2. Hide "Delete draft" in an overflow menu
                  3. Compact icon-only buttons on mobile
                Keep desktop layout unchanged. Match MM design system (12px radius,
                #4b89ef primary, Inter). The mobile Publish button is already
                available in a sticky bottom bar (PR #639), so the top version
                can be more compact. */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
              <div className="relative w-full sm:w-auto">
                  <ProjectPrivacySelect
                    value={isPrivate}
                    onValueChange={setIsPrivate}
                  />
              </div>
              <div className="flex items-center justify-end gap-2">
                {/* Desktop actions */}
                <div className="hidden sm:flex items-center gap-1">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      router.push(
                        eventDetails?.slug
                          ? `/events/${eventDetails.slug}/overview`
                          : eventId
                            ? `/events/${eventId}/overview`
                            : `/projects`
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
                </div>

                {/* Mobile overflow actions */}
                <div className="relative sm:hidden">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="rounded-xl border-[rgba(0,0,0,0.15)] bg-white"
                    onClick={() =>
                      setShowMobileActions((prev) => !prev)
                    }
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                  {showMobileActions && (
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] shadow-lg z-20 py-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowMobileActions(false);
                          router.push(
                            eventDetails?.slug
                              ? `/events/${eventDetails.slug}/overview`
                              : eventId
                                ? `/events/${eventId}/overview`
                                : `/projects`
                          );
                        }}
                        className="w-full text-left px-4 py-2.5 text-[15px] hover:bg-[#F2F2F2]"
                      >
                        Save draft and exit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowMobileActions(false);
                          handleDeleteDraft();
                        }}
                        disabled={isDeletingDraft}
                        className="w-full text-left px-4 py-2.5 text-[15px] text-red-600 hover:bg-[#FCE8E6] disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Delete draft
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-between gap-[50px] sm:gap-[85px] flex-wrap-reverse sm:flex-nowrap">
              {/* Left Side - Form */}
              <div className="flex-1 space-y-6">
                <div className="space-y-1">
                  <h1 className="text-[28px] font-semibold text-black tracking-[-0.06em] leading-[1.4]">
                    Create your project
                  </h1>
                  <p className="text-base text-black">
                    Start building your project with automatic saving as you go.
                    Share when you&apos;re ready!
                  </p>
                </div>

                <div className="space-y-4">
                  <ProjectSubmissionSchemaSection
                    fields={effectiveSubmissionFields}
                    values={submissionFieldValues}
                    onValueChange={handleSubmissionFieldChange}
                    onFileUpload={async (fieldKey, file) => {
                      if (fieldKey === "cover_image") {
                        const event = {
                          target: { files: [file] },
                        } as unknown as React.ChangeEvent<HTMLInputElement>;
                        await handleCoverImageUpload(event);
                        return;
                      }

                      const uploadedUrl = await uploadAdditionalMaterialFile(file);
                      if (!uploadedUrl) return;

                      if (fieldKey === "additional_materials") {
                        handleSubmissionFieldChange(fieldKey, [
                          ...(
                            Array.isArray(submissionFieldValues.additional_materials)
                              ? submissionFieldValues.additional_materials
                              : []
                          ),
                          uploadedUrl,
                        ]);
                        return;
                      }

                      handleSubmissionFieldChange(fieldKey, uploadedUrl);
                    }}
                    showDescriptionPreview={showDescriptionPreview}
                    onToggleDescriptionPreview={() =>
                      setShowDescriptionPreview((prev) => !prev)
                    }
                  />

                  {/* Tracks Selection (if event has tracks) */}
                  {eventId && availableTracks && availableTracks.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-base text-black font-normal">
                        Select tracks
                      </label>
                      <div className="space-y-2">
                        {availableTracks.map((track) => (
                          <label
                            key={track.id}
                            className="flex items-center gap-2"
                          >
                            <input
                              type="checkbox"
                              checked={selectedTrackIds.includes(track.id)}
                              onChange={(e) =>
                                handleTrackToggle(track.id, e.target.checked)
                              }
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-black">
                              {track.name}
                            </span>
                          </label>
                        ))}
                      </div>
                      <p className="text-sm text-[#7f7f7f]">
                        Choose the tracks your project should compete in.
                      </p>
                    </div>
                  )}

                  {!hasConfiguredSubmissionFields ? (
                    <>
                      <div className="space-y-2">
                        <label className="text-base text-black font-normal">
                          Additional project links (Optional)
                        </label>
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

                      <div className="space-y-2">
                        <label className="text-base text-black font-normal">
                          Additional video links (Optional)
                        </label>
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
                    </>
                  ) : null}

                  <div className="border-t border-dashed border-gray-200" />

                  {/* Add Teammates */}
                  <div className="space-y-2">
                    <label className="text-base text-black font-normal">
                      Add teammates (Optional)
                    </label>
                    <div className="border border-gray-200 rounded-xl">
                      <div className="pt-2 px-3 border-b border-gray-200">
                        <UserSearchWithInvite
                          allTags={participants.map((p) =>
                            p.display_name && p.display_name !== p.email
                              ? `${p.display_name} (${p.email})`
                              : p.email
                          )}
                          onTagsChange={handleTeammatesChange}
                          initialTags={formData.teammates.map((email) => {
                            const participant = participants.find(
                              (p) => p.email === email
                            );
                            return participant?.display_name &&
                              participant.display_name !== email
                              ? `${participant.display_name} (${email})`
                              : email;
                          })}
                          projectId={projectId || undefined}
                          enableInvite={true}
                          enableMailIcon={true}
                          inputStyle="pure"
                          placeholder="Enter your teammates' emails. Press Enter or comma to add each."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Spacer to ensure dropdown visibility */}
                </div>
              </div>

              {/* Right Side - Preview & Actions */}
              <div className="space-y-3">
                {/* Preview Card */}
                <div className="space-y-3">
                  <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl overflow-hidden w-full sm:w-[339px]">
                    {/* Cover Image */}
                    <div className="aspect-[339/220] relative">
                      {formData.coverImageUrl ? (
                        <CoverImageWithFallback
                          src={formData.coverImageUrl}
                          alt="Cover"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-3">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="text-[22px] font-semibold text-black tracking-[-0.06em] leading-[1.4]">
                              {formData.projectName || "Relief Map"}
                            </h3>
                            <Badge
                              variant="secondary"
                              className="bg-white border border-[rgba(0,0,0,0.15)] text-black rounded-full text-sm"
                            >
                              Draft
                            </Badge>
                            <Badge
                              variant="secondary"
                              className="bg-white border border-[rgba(0,0,0,0.15)] text-black rounded-full text-sm"
                            >
                              Owner
                            </Badge>
                          </div>
                          <p className="text-base text-black line-clamp-2">
                            {formData.projectDescription ||
                              "Join the community and enter weekly raffles for free conference tickets and VIP upgrades, plus free credits for top AI and SaaS tools."}
                          </p>
                        </div>

                        {/* Metadata */}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <CalendarClock className="h-5 w-5 text-[#575d65]" />
                            <span className="text-sm text-[#575d65]">
                              {new Date().toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
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
                    onClick={handlePreviewClick}
                    disabled={!projectId}
                    title={
                      projectId
                        ? "Open project preview in a new tab"
                        : "Preview available after draft is created"
                    }
                    className="flex items-center gap-1 justify-center text-[#7f7f7f] hover:text-black transition-colors w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="text-base">Preview project page</span>
                    <ExternalLink className="h-4.5 w-4.5" />
                  </button>
                </div>

                {/* Submitted to - Only show if event exists */}
                {eventDetails && (
                  <>
                    <div className="border-t border-gray-200" />
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-black tracking-tight">
                        Submitted to
                      </h3>
                      <div className="w-[339px]">
                        <EventCard
                          event={{
                            event_id: eventDetails.event_id,
                            slug: eventDetails.slug,
                            event_name: eventDetails.event_name,
                            event_date: eventDetails.event_date,
                            location: eventDetails.location || "Online",
                            cover_image_url: eventDetails.cover_image_url,
                            paid: eventDetails.paid,
                            event_blurb:
                              eventDetails.event_blurb ||
                              eventDetails.event_description,
                            event_description: eventDetails.event_description,
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky bottom submit bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[rgba(0,0,0,0.15)] px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
        <Button
          onClick={handlePublish}
          disabled={isSubmitting}
          className="w-full bg-[#4b89ef] hover:bg-[#3d75d9] text-white rounded-xl py-3 shadow-sm font-medium text-base"
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
      </div>
    </div>
  );
}
