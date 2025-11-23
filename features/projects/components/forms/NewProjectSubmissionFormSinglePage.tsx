"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  CalendarClock,
  ThumbsUp,
  MessageSquarePlus,
  MoreHorizontal,
  ImageIcon,
  Paperclip,
  Github,
  Youtube,
  ExternalLink,

} from "lucide-react";
import { toast } from "@/lib/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import UserSearchWithInvite from "@/components/utils/UserSearchWithInvite";
import { useAdmin } from "@/lib/hooks/use-admin";
import { EventDetails, EventVisibility } from "@/lib/types";
import { useProjectSubmissionData } from "@/features/projects/components/forms/hooks/useProjectSubmissionData";
import { EventCard } from "@/components/events/event-card";
import { Public, TextFields } from "@mui/icons-material";

interface EventParticipant {
  user_id: string;
  display_name: string;
  email: string;
}

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
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPrefilling, setIsPrefilling] = useState(false);
  const [eventDetails, setEventDetails] = useState<EventDetails | null>(null);
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<EventVisibility>(EventVisibility.Public);
  const [showVisibilityDropdown, setShowVisibilityDropdown] = useState(false);

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
        .eq("event_id", eventId)
        .overrideTypes<
          {
            user_id: string;
            profiles: { display_name: string | null; email: string | null };
          }[]
        >();

      const participantList: EventParticipant[] = (data || [])
        .filter(
          (role: {
            user_id: string;
            profiles: { display_name: string | null; email: string | null };
          }) => role.profiles?.email
        )
        .map(
          (role: {
            user_id: string;
            profiles: { display_name: string | null; email: string | null };
          }) => ({
            user_id: role.user_id,
            display_name:
              role.profiles?.display_name || role.profiles?.email || "",
            email: role.profiles?.email || "",
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
  }, [formData, projectId, isLoading]);

  const handleAutoSave = async () => {
    if (!projectId || isLoading || isSaving) return;

    setIsSaving(true);
    try {
      // Filter out invited users (those not in the participants list)
      // Only save teammates who are actual event participants
      const participantEmails = participants.map((p) => p.email.toLowerCase());
      const validTeammates = formData.teammates.filter((email) =>
        participantEmails.includes(email.toLowerCase())
      );

      const payload: Record<string, unknown> = {
        project_name: formData.projectName.trim() || undefined,
        project_description: formData.projectDescription.trim() || undefined,
        project_url: formData.projectUrl.trim() || undefined,
        video_url: formData.videoUrl.trim() || null,
        cover_image_url: formData.coverImageUrl.trim() || undefined,
        additional_materials_url:
          formData.additionalMaterialsUrl.trim() || undefined,
        lead_name: formData.leadName,
        lead_email: formData.leadEmail,
        teammates: validTeammates,
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

  const handleAdditionalMaterialsUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
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

      setFormData((prev) => ({ ...prev, additionalMaterialsUrl: publicUrl }));

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

  // Prefill via Contextus
  const handlePrefill = async () => {
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description:
          "Only administrators can use the Contextus prefill feature.",
        variant: "destructive",
      });
      return;
    }

    setIsPrefilling(true);
    try {
      const resp = await fetch("/api/contextus/prefill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          projectId ? { projectId } : { eventId, leadEmail: formData.leadEmail }
        ),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Prefill failed: ${resp.status}`);
      }
      const json = await resp.json();
      const data = json?.data || {};

      setFormData((prev) => ({
        ...prev,
        projectName: data.projectName || prev.projectName,
        projectDescription: data.projectDescription || prev.projectDescription,
        teammates: Array.isArray(data.teammates)
          ? data.teammates
          : prev.teammates,
        projectUrl: data.projectUrl || prev.projectUrl,
        videoUrl: data.videoUrl || prev.videoUrl,
      }));

      toast({
        title: "Form Prefilled",
        description:
          "Imported details from Contextus. Review and adjust as needed.",
      });
    } catch (error) {
      toast({
        title: "Prefill Error",
        description:
          error instanceof Error ? error.message : "Unable to prefill.",
        variant: "destructive",
      });
    } finally {
      setIsPrefilling(false);
    }
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

    if (formData.projectDescription.trim().length < 10) {
      toast({
        title: "Insufficient Project Description",
        description:
          "Please provide a more detailed project description (minimum 10 characters).",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    try {
      // Filter out invited users (those not in the participants list)
      // Only submit teammates who are actual event participants
      const participantEmails = participants.map((p) => p.email.toLowerCase());
      const validTeammates = formData.teammates.filter((email) =>
        participantEmails.includes(email.toLowerCase())
      );

      const response = await fetch("/api/projects/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          projectName: formData.projectName,
          leadName: formData.leadName,
          leadEmail: formData.leadEmail,
          projectDescription: formData.projectDescription,
          teammates: validTeammates,
          projectUrl: formData.projectUrl,
          coverImageUrl: formData.coverImageUrl,
          additionalMaterialsUrl: formData.additionalMaterialsUrl,
          eventId,
          trackIds: selectedTrackIds,
          videoUrl: formData.videoUrl,
        }),
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

      {/* Sticky Auto-save Banner */}
      <div className="sticky top-0 z-20 bg-sky-50 border-b border-[#d8d8d8]">
        <div className="px-6 py-3.5 flex items-center justify-between flex-wrap">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#1f1f1f"><g><rect fill="none" height="24" width="24" /><path d="M12,3.19l7,3.11V11c0,4.52-2.98,8.69-7,9.93C7.98,19.69,5,15.52,5,11V6.3L12,3.19 M12,1L3,5v6c0,5.55,3.84,10.74,9,12 c5.16-1.26,9-6.45,9-12V5L12,1L12,1z M11,7h2v2h-2V7z M11,11h2v6h-2V11z" /></g></svg>
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
            <div className="flex items-center justify-between mb-6 flex-wrap gap-2 sm:gap-0">
              <div className="relative">
                <button
                  onClick={() => setShowVisibilityDropdown(!showVisibilityDropdown)}
                  className="flex items-center gap-2 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] px-3 py-2 h-[44px] w-[142px] hover:bg-gray-50 transition-colors"
                >
                  <Public className="w-6 h-6" />
                  <span className="text-[16px] font-normal">{visibility.charAt(0).toUpperCase() + visibility.slice(1)}</span>
                  <svg className="w-6 h-6 ml-auto" viewBox="0 0 24 24" fill="none">
                    <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {showVisibilityDropdown && (
                  <div className="absolute top-full py-1.5 px-1 mt-2 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] shadow-lg z-10 w-[160px] overflow-hidden">
                    {[EventVisibility.Public, EventVisibility.Private].map((vis) => (
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
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 justify-end">
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
                  Cancel
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

                {/* {isAdmin && (
                  <Button
                    variant="secondary"
                    className="flex items-center gap-2"
                    onClick={handlePrefill}
                    disabled={isPrefilling}
                  >
                    {isPrefilling ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Prefilling...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Fill out this form for me
                      </>
                    )}
                  </Button>
                )} */}

                <div className="space-y-4">
                  {/* Project Name */}
                  <div className="space-y-2">
                    <label className="text-base text-black font-normal">
                      Project name
                    </label>
                    <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 flex items-center gap-3 h-11">
                      <TextFields className="h-6 w-6 shrink-0" />
                      <Input
                        value={formData.projectName}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            projectName: e.target.value,
                          }))
                        }
                        placeholder="Short description shown in the preview card"
                        className="border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
                      />
                    </div>
                  </div>

                  {/* Project Description */}
                  <div className="space-y-2">
                    <label className="text-base text-black font-normal">
                      Project Description
                    </label>
                    <Textarea
                      value={formData.projectDescription}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          projectDescription: e.target.value,
                        }))
                      }
                      placeholder="Long description or markdown"
                      rows={7}
                      className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 text-base resize-none"
                    />
                  </div>

                  {/* Divider */}
                  <div className="border-t border-dashed border-gray-200" />

                  {/* Tracks Selection (if event has tracks) */}
                  {eventId && availableTracks && availableTracks.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-base text-black font-normal">
                        Select tracks
                      </label>
                      <div className="space-y-2">
                        {availableTracks.map((track) => (
                          <label key={track.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedTrackIds.includes(track.id)}
                              onChange={(e) =>
                                handleTrackToggle(track.id, e.target.checked)
                              }
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-black">{track.name}</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-sm text-[#7f7f7f]">
                        Choose the tracks your project should compete in.
                      </p>
                    </div>
                  )}

                  {/* Cover Image */}
                  <div className="space-y-2">
                    <label className="text-base text-black font-normal">
                      Cover image url
                    </label>
                    <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 flex items-center gap-3 h-11">
                      <ImageIcon className="h-6 w-6 shrink-0" />
                      <Input
                        value={formData.coverImageUrl}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            coverImageUrl: e.target.value,
                          }))
                        }
                        placeholder="https://..."
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
                        Upload an image to showcase your project (Max 10MB).
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
                        value={formData.additionalMaterialsUrl}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            additionalMaterialsUrl: e.target.value,
                          }))
                        }
                        placeholder="https://..."
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
                      <p className="text-base text-[#7f7f7f]">
                        Upload any additional documentation (Max 10MB).
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
                        value={formData.projectUrl}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            projectUrl: e.target.value,
                          }))
                        }
                        placeholder="https://..."
                        className="border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 text-base text-[rgba(0,0,0,0.6)]"
                      />
                    </div>
                  </div>

                  {/* Video Link */}
                  <div className="space-y-2">
                    <label className="text-base text-black font-normal">
                      Video link (Optional)
                    </label>
                    <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 flex items-center gap-3 h-11">
                      <Youtube className="h-6 w-6 shrink-0" />
                      <Input
                        value={formData.videoUrl}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            videoUrl: e.target.value,
                          }))
                        }
                        placeholder="https://..."
                        className="border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 text-base text-[rgba(0,0,0,0.6)]"
                      />
                    </div>
                  </div>

                  {/* Divider */}
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
                        <img
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
                              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
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
    </div>
  );
}
