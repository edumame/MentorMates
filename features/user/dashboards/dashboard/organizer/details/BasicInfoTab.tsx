"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { EventDetails, EventVisibility } from "@/lib/types";
import { useRouter } from "next/navigation";
import { toast as ToastType } from "@/lib/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { customMarkdownComponents } from "@/components/markdown/custom-components";
import { markdownRehypePlugins } from "@/components/markdown/plugins";
import {
  Users,
  Building2,
  Video,
  MapPin,
  Image as ImageIcon,
  Type,
  Mail,
  Upload,
} from "lucide-react";

interface BasicInfoTabProps {
  event: EventDetails;
  setEvent: React.Dispatch<React.SetStateAction<EventDetails | null>>;
  saving: boolean;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  toast: typeof ToastType;
  router: ReturnType<typeof useRouter>;
  registerSaveHandler?: (fn: null | (() => Promise<void> | void)) => void;
}

export function BasicInfoTab({
  event,
  setEvent,
  saving,
  setSaving,
  toast,
  router,
  registerSaveHandler,
}: BasicInfoTabProps) {
  type ImportedPrize = { prize_amount: string; prize_description: string };
  type ImportedCriterion = {
    name: string;
    description?: string;
    weight?: number;
    min?: number;
    max?: number;
    type?: "numeric" | "multiplechoice";
    options?: string[];
  };
  type ImportedTrack = {
    name: string;
    description?: string;
    label?: string;
    prizes?: ImportedPrize[];
    criteria?: ImportedCriterion[];
  };
  type ImportedPayload = {
    slug?: string;
    event_name?: string;
    event_date?: string;
    location?: string;
    event_blurb?: string;
    event_description?: string;
    submission_time_start?: string;
    submission_time_cutoff?: string;
    event_schedule?: EventDetails["event_schedule"];
    rules?: EventDetails["rules"];
    event_resources?: EventDetails["event_resources"];
    faq?: string;
    tracks?: ImportedTrack[];
  };
  const [selectedCoverImage, setSelectedCoverImage] = useState<File | null>(
    null
  );
  const [useImageUrl, setUseImageUrl] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [updateSlug, setUpdateSlug] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [devpostUrl, setDevpostUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [locationType, setLocationType] = useState<"in-person" | "virtual">(
    event.location?.toLowerCase().includes("online") || 
    event.location?.toLowerCase().includes("virtual") ||
    !event.location
      ? "virtual"
      : "in-person"
  );
  const [descriptionMode, setDescriptionMode] = useState<"edit" | "preview">("edit");
  const PRESET_EVENT_TYPES = ["Hackathon", "Workshop", "Conference"] as const;
  const isPresetType = (val?: string | null) =>
    !!val &&
    PRESET_EVENT_TYPES.includes(val as (typeof PRESET_EVENT_TYPES)[number]);
  const [eventTypeSelection, setEventTypeSelection] = useState<string>(
    isPresetType(event?.event_type) ? event!.event_type : "Other"
  );
  const [customEventType, setCustomEventType] = useState<string>(
    isPresetType(event?.event_type) ? "" : event?.event_type || ""
  );
  
  // Get user's timezone as default
  const getUserTimezone = (): string => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "UTC";
    }
  };
  
  const [submissionTimezone, setSubmissionTimezone] = useState<string>(() => getUserTimezone());

  // Keep local event type controls in sync if parent event changes
  // (e.g., after import or external updates)
  useEffect(() => {
    if (!event) return;
    if (isPresetType(event.event_type)) {
      setEventTypeSelection(event.event_type);
      setCustomEventType("");
    } else {
      setEventTypeSelection("Other");
      setCustomEventType(event.event_type || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.event_type]);

  const handleBasicInfoUpdate = async () => {
    if (!event) return;

    try {
      setSaving(true);
      let coverImageUrl = event.cover_image_url;

      // Handle file upload if there's a new file selected
      if (selectedCoverImage) {
        const fileExt = selectedCoverImage.name.split(".").pop();
        const fileName = `${Math.random()
          .toString(36)
          .substring(2)}.${fileExt}`;
        const filePath = `event-covers/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("event-materials")
          .upload(filePath, selectedCoverImage);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("event-materials").getPublicUrl(filePath);

        coverImageUrl = publicUrl;
      }

      // Update event with new cover image URL if it changed
      const { error } = await supabase
        .from("events")
        .update({
          event_name: event.event_name,
          slug: event.slug,
          event_date: event.event_date,
          location: event.location,
          event_description: event.event_description,
          event_blurb: event.event_blurb,
          event_type: event.event_type,
          paywall_content: event.paywall_content,
          cover_image_url: coverImageUrl,
          submission_time_start: event.submission_time_start,
          submission_time_cutoff: event.submission_time_cutoff,
          participant_capacity: event.participant_capacity ?? null,
          finalist_recommendation_enabled:
            event.finalist_recommendation_enabled ?? false,
        })
        .eq("event_id", event.event_id);

      if (error) throw error;

      // Update local state
      setEvent({ ...event, cover_image_url: coverImageUrl });
      setSelectedCoverImage(null);
      setPreviewUrl(null);

      // Refresh the page to update the overview
      router.refresh();

      if (updateSlug) {
        setUpdateSlug(false);
        router.push(`/events/${event.slug}/overview`);
      }

      toast({
        title: "Success",
        description: "Changes saved successfully",
      });
    } catch (error) {
      console.error("Error updating event:", error);
      toast({
        title: "Error",
        description: "Failed to save changes",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveToggle = async () => {
    if (!event) return;

    try {
      setArchiving(true);
      const action =
        event.visibility === EventVisibility.Archived ? "unarchive" : "archive";

      const res = await fetch(`/api/events/${event.event_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Failed to ${action} event`);
      }

      const result = await res.json();

      // Update local state
      setEvent({ ...event, visibility: result.newVisibility });

      toast({
        title: "Success",
        description: `Event ${action}d successfully`,
      });

      // Refresh the page to update any cached data
      router.refresh();
    } catch (error) {
      console.error(
        `Error ${event.visibility === EventVisibility.Archived ? "unarchiving" : "archiving"} event:`,
        error
      );
      toast({
        title: "Error",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setArchiving(false);
    }
  };

  const isArchived = event.visibility === EventVisibility.Archived;

  // Let the parent header trigger saves (Update Event button).
  useEffect(() => {
    if (!registerSaveHandler) return;
    registerSaveHandler(handleBasicInfoUpdate);
    return () => registerSaveHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerSaveHandler, event, selectedCoverImage, useImageUrl, previewUrl, updateSlug]);

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* Archived Event Warning */}
      {isArchived && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTitle className="text-orange-900">
            ⚠️ Event is Archived
          </AlertTitle>
          <AlertDescription>
            This event is archived and cannot be edited. To make changes, you
            must first unarchive the event using the controls below.
          </AlertDescription>
        </Alert>
      )}

      {/* Large Event Title Input */}
      <input
        type="text"
        value={event.event_name || ""}
        onChange={(e) =>
          setEvent({ ...event, event_name: e.target.value })
        }
        disabled={isArchived}
        placeholder="Event Title"
        className="font-semibold text-[36px] leading-[1.3] tracking-[-2.16px] mb-6 w-full min-w-0 bg-transparent border-none outline-none focus:ring-0 p-0 disabled:opacity-50"
        style={{
          color: event.event_name ? "#000000" : "#d8d8d8",
          fontFamily: "Geist, sans-serif",
        }}
      />

      <div className="space-y-4 w-full min-w-0">
        {/* Date */}
        <div className="space-y-2 w-full min-w-0">
          <label className="text-[16px] font-normal text-black">
            Date
          </label>
          <DatePicker
            value={event.event_date || ""}
            onChange={(value) =>
              setEvent({ ...event, event_date: value })
            }
            placeholder="mm/dd/yyyy"
            disabled={isArchived}
          />
        </div>

        {/* Project submission window */}
        <div className="space-y-4">
          <label className="text-[16px] font-normal text-black">
            Project submission window
          </label>
          
          {/* Timezone Selector - Moved to top for better UX */}
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Display timezone</label>
            <Select
              value={submissionTimezone}
              onValueChange={setSubmissionTimezone}
              disabled={isArchived}
            >
              <SelectTrigger className="h-[44px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px]">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {/* Show user's timezone first if it's not in the standard list */}
                {(() => {
                  const userTz = getUserTimezone();
                  const standardTimezones = [
                    "UTC",
                    "America/New_York",
                    "America/Chicago",
                    "America/Denver",
                    "America/Los_Angeles",
                    "America/Phoenix",
                    "America/Anchorage",
                    "Pacific/Honolulu",
                    "Europe/London",
                    "Europe/Paris",
                    "Asia/Tokyo",
                    "Asia/Shanghai",
                    "Asia/Dubai",
                    "Australia/Sydney",
                  ];
                  
                  if (!standardTimezones.includes(userTz)) {
                    return (
                      <SelectItem value={userTz}>
                        {userTz.replace(/_/g, " ")} (Your timezone)
                      </SelectItem>
                    );
                  }
                  return null;
                })()}
                <SelectItem value="UTC">UTC</SelectItem>
                <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                <SelectItem value="America/Phoenix">Arizona Time (MST)</SelectItem>
                <SelectItem value="America/Anchorage">Alaska Time (AKT)</SelectItem>
                <SelectItem value="Pacific/Honolulu">Hawaii Time (HST)</SelectItem>
                <SelectItem value="Europe/London">London (GMT/BST)</SelectItem>
                <SelectItem value="Europe/Paris">Paris (CET/CEST)</SelectItem>
                <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                <SelectItem value="Asia/Shanghai">Shanghai (CST)</SelectItem>
                <SelectItem value="Asia/Dubai">Dubai (GST)</SelectItem>
                <SelectItem value="Australia/Sydney">Sydney (AEDT/AEST)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Auto-detected: {getUserTimezone().replace(/_/g, " ")} • Times stored in UTC
            </p>
          </div>

          {/* Date/Time Pickers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-600">Start</label>
              <DateTimePicker
                value={event.submission_time_start || ""}
                onChange={(value) =>
                  setEvent({ ...event, submission_time_start: value })
                }
                placeholder="Select start date & time"
                disabled={isArchived}
                timezone={submissionTimezone}
                showTimezone={false}
                onTimezoneChange={setSubmissionTimezone}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-600">End</label>
              <DateTimePicker
                value={event.submission_time_cutoff || ""}
                onChange={(value) =>
                  setEvent({ ...event, submission_time_cutoff: value })
                }
                placeholder="Select end date & time"
                disabled={isArchived}
                timezone={submissionTimezone}
                showTimezone={false}
                onTimezoneChange={setSubmissionTimezone}
              />
            </div>
          </div>
        </div>

        {/* Seat Cap */}
        <div className="space-y-2">
          <label className="text-[16px] font-normal text-black">
            Seat Cap
          </label>
          <div className="relative w-full min-w-0">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
            <Input
              type="number"
              value={
                typeof event.participant_capacity === "number"
                  ? String(event.participant_capacity)
                  : ""
              }
              disabled={isArchived}
              onChange={(e) => {
                const value = e.target.value;
                setEvent({
                  ...event,
                  participant_capacity:
                    value === "" ? null : Math.max(0, parseInt(value, 10) || 0),
                });
              }}
              placeholder="Leave blank for unlimited participants"
              className="w-full min-w-0 h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
            />
          </div>
          <p className="text-xs text-gray-500">
            Leave blank for unlimited participants.
          </p>
        </div>

        {/* Location */}
        <div className="space-y-2 w-full">
          <label className="text-[16px] font-normal text-black">
            Location
          </label>
          <div className="flex items-center gap-2 sm:gap-4 mb-2 w-full">
            <button
              type="button"
              onClick={() => {
                setLocationType("in-person");
                if (!event.location || event.location.toLowerCase().includes("online") || event.location.toLowerCase().includes("virtual")) {
                  setEvent({ ...event, location: "" });
                }
              }}
              disabled={isArchived}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-[12px] text-[16px] font-normal transition-colors flex-1 sm:w-[180px] disabled:opacity-50 ${
                locationType === "in-person"
                  ? "bg-[#4b89ef] text-white"
                  : "bg-transparent border border-[rgba(0,0,0,0.15)] text-black"
              }`}
            >
              <Building2 className="w-5 h-5" />
              In-person
            </button>
            <button
              type="button"
              onClick={() => {
                setLocationType("virtual");
                if (!event.location || (!event.location.toLowerCase().includes("online") && !event.location.toLowerCase().includes("virtual"))) {
                  setEvent({ ...event, location: "Online" });
                }
              }}
              disabled={isArchived}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-[12px] text-[16px] font-normal transition-colors flex-1 sm:w-[180px] disabled:opacity-50 ${
                locationType === "virtual"
                  ? "bg-[#4b89ef] text-white"
                  : "bg-transparent border border-[rgba(0,0,0,0.15)] text-black"
              }`}
            >
              <Video className="w-5 h-5" />
              Virtual event
            </button>
          </div>
          <div className="relative w-full min-w-0">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
            <Input
              value={event.location || ""}
              disabled={isArchived}
              onChange={(e) =>
                setEvent({ ...event, location: e.target.value })
              }
              placeholder={locationType === "in-person" ? "Add offline location" : "Online"}
              className="w-full min-w-0 h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
            />
          </div>
        </div>

        {/* Cover image url */}
        <div className="space-y-2">
          <label className="text-[16px] font-normal text-black">
            Cover image url
          </label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
              <Input
                value=""
                disabled={isArchived}
                onChange={(e) => {
                  setEvent({
                    ...event,
                    cover_image_url: e.target.value,
                  });
                  setPreviewUrl(e.target.value);
                }}
                placeholder="https://..."
                className="w-full min-w-0 h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={isArchived}
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) {
                    setSelectedCoverImage(file);
                    const preview = URL.createObjectURL(file);
                    setPreviewUrl(preview);
                  }
                };
                input.click();
              }}
              className="h-[44px] px-4 border border-[rgba(0,0,0,0.15)] rounded-[12px] w-full sm:w-auto"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            *Upload an image to showcase your project (Max 10MB).
          </p>
          
          {/* Cover Image Preview - URL obfuscated, show actual image */}
          {(previewUrl || event.cover_image_url) && (
            <div className="mt-3">
              <img
                src={previewUrl || event.cover_image_url || ""}
                alt="Cover preview"
                className="rounded-[12px] object-cover w-full max-w-[600px] h-[300px] border border-[rgba(0,0,0,0.15)]"
              />
            </div>
          )}
        </div>

        {/* Blurb */}
        <div className="space-y-2">
          <label className="text-[16px] font-normal text-black">
            Blurb
          </label>
          <div className="relative w-full min-w-0">
            <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
            <Input
              value={event.event_blurb || ""}
              disabled={isArchived}
              onChange={(e) =>
                setEvent({ ...event, event_blurb: e.target.value })
              }
              placeholder="Short description shown in the preview card"
              className="w-full min-w-0 h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
            />
          </div>
          <p className="text-xs text-gray-500">
            A short description that appears in the event preview card.
          </p>
        </div>


        {/* Description */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[16px] font-normal text-black">
              Description
            </label>
            <div className="inline-flex items-center border border-[rgba(0,0,0,0.15)] rounded-[12px] p-1 bg-white">
              <button
                type="button"
                onClick={() => setDescriptionMode("edit")}
                disabled={isArchived}
                className={`px-4 py-2 rounded-[8px] text-sm font-normal transition-colors disabled:opacity-50 ${
                  descriptionMode === "edit"
                    ? "bg-white border border-[rgba(0,0,0,0.15)] text-black shadow-sm"
                    : "bg-transparent text-black hover:bg-gray-50"
                }`}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setDescriptionMode("preview")}
                disabled={isArchived}
                className={`px-4 py-2 rounded-[8px] text-sm font-normal transition-colors disabled:opacity-50 ${
                  descriptionMode === "preview"
                    ? "bg-white border border-[rgba(0,0,0,0.15)] text-black shadow-sm"
                    : "bg-transparent text-black hover:bg-gray-50"
                }`}
              >
                Preview
              </button>
            </div>
          </div>
          {descriptionMode === "edit" ? (
            <>
              <Textarea
                value={event.event_description || ""}
                disabled={isArchived}
                onChange={(e) =>
                  setEvent({
                    ...event,
                    event_description: e.target.value,
                  })
                }
                placeholder="Add long description (markdown supported)"
                className="min-h-[300px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] p-3 focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none resize-y"
              />
              <p className="text-xs text-gray-500 italic">
                *Full event description. Markdown formatting is supported.
              </p>
            </>
          ) : (
            <div className="min-h-[300px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] p-3 overflow-auto prose prose-sm max-w-full">
              {event.event_description ? (
                <ReactMarkdown>{event.event_description}</ReactMarkdown>
              ) : (
                <em>No description added yet.</em>
              )}
            </div>
          )}
        </div>

        {/* Event Type */}
        <div className="space-y-2">
          <label className="text-[16px] font-normal text-black">
            Event Type
          </label>
          <Select
            value={eventTypeSelection}
            onValueChange={(val) => {
              setEventTypeSelection(val);
              if (val === "Other") {
                setEvent({ ...event, event_type: customEventType });
              } else {
                setCustomEventType("");
                setEvent({ ...event, event_type: val });
              }
            }}
            disabled={isArchived}
          >
            <SelectTrigger className="w-full h-[44px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px]">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {PRESET_EVENT_TYPES.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
          {eventTypeSelection === "Other" && (
            <div className="pt-2 space-y-1">
              <Input
                id="event_type_custom"
                placeholder="Enter custom type (e.g., Demo Day)"
                value={customEventType}
                disabled={isArchived}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomEventType(val);
                  setEvent({ ...event, event_type: val });
                }}
                className="h-[44px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)]"
              />
              <p className="text-xs text-gray-500">
                Use a custom label like &quot;Demo Day&quot; or &quot;Pitch Night&quot;.
              </p>
            </div>
          )}
        </div>

        {/* URL Slug */}
        <div className="space-y-2">
          <label className="text-[16px] font-normal text-black">
            URL Slug
          </label>
          <Input
            value={event.slug || ""}
            disabled={isArchived}
            onChange={(e) => {
              setEvent({ ...event, slug: e.target.value });
              setUpdateSlug(true);
            }}
            placeholder="url-friendly-event-name"
            className="h-[44px] font-mono text-sm bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)]"
          />
          <p className="text-xs text-gray-500">
            URL-friendly identifier for your event (lowercase, hyphens only)
          </p>
        </div>

        {/* Finalist Recommendation Toggle */}
        <div className="space-y-2">
          <label className="text-[16px] font-normal text-black">
            Enable finalist recommendation
          </label>
          <div className="flex items-center gap-3">
            <Switch
              checked={!!event.finalist_recommendation_enabled}
              disabled={isArchived}
              onCheckedChange={(checked) =>
                setEvent({ ...event, finalist_recommendation_enabled: checked })
              }
            />
            <span className="text-sm text-gray-500">
              Judges can mark projects as recommended for finals
            </span>
          </div>
        </div>

        {/* Import from Devpost */}
        <div className="space-y-2">
          <label className="text-[16px] font-normal text-black">
            Import from Devpost
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="url"
              placeholder="https://<event>.devpost.com/"
              value={devpostUrl}
              disabled={isArchived || importing}
              onChange={(e) => setDevpostUrl(e.target.value)}
              className="flex-1 min-w-0 h-[44px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)]"
            />
            <Button
              type="button"
              disabled={isArchived || importing || !devpostUrl}
              className="shrink-0 whitespace-nowrap h-[44px]"
              onClick={async () => {
                if (!event?.event_id) return;
                try {
                  setImporting(true);
                  const res = await fetch("/api/devpost/import", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ eventId: event.event_id, url: devpostUrl }),
                  });
                  if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    throw new Error(body?.error || "Failed to import Devpost data");
                  }
                  const data = await res.json();
                  const imported = data?.import || {};
                  const merged = {
                    ...event,
                    slug: imported.slug ?? event.slug,
                    event_name: imported.event_name ?? event.event_name,
                    event_date: imported.event_date ?? event.event_date,
                    location: imported.location ?? event.location,
                    event_blurb: imported.event_blurb ?? event.event_blurb,
                    event_description: imported.event_description ?? event.event_description,
                    submission_time_start: imported.submission_time_start ?? event.submission_time_start,
                    submission_time_cutoff: imported.submission_time_cutoff ?? event.submission_time_cutoff,
                    event_schedule: imported.event_schedule ?? event.event_schedule,
                    rules: imported.rules ?? event.rules,
                    event_resources: imported.event_resources ?? event.event_resources,
                    faq: imported.faqs ?? imported.faq ?? event.faq,
                  } as typeof event;
                  if (Array.isArray(imported.tracks) && imported.tracks.length > 0) {
                    const newTracks = imported.tracks.map((t: ImportedTrack) => {
                      const trackId = crypto.randomUUID();
                      const prizes = Array.isArray(t?.prizes)
                        ? t.prizes.map((p: ImportedPrize) => ({
                            id: `local-${crypto.randomUUID()}`,
                            track_id: trackId,
                            prize_amount: String(p?.prize_amount || ""),
                            prize_description: String(p?.prize_description || ""),
                          }))
                        : [];
                      return {
                        track_id: trackId,
                        event_id: event.event_id,
                        name: String(t?.name || ""),
                        description: String(t?.description || t?.name || ""),
                        label: t?.label ? String(t.label) : undefined,
                        prizes,
                        scoring_criteria: t?.criteria
                          ? {
                              name: String(t.name || "Track"),
                              criteria: t.criteria,
                            }
                          : { name: String(t.name || "Track"), criteria: [] },
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                      };
                    });
                    (merged as EventDetails).event_tracks = newTracks;
                  }
                  setEvent(merged);
                  toast({
                    title: "Imported",
                    description: "Devpost details imported. Review and save your changes.",
                  });
                } catch (err) {
                  console.error(err);
                  toast({
                    title: "Import failed",
                    description: (err as Error).message,
                    variant: "destructive",
                  });
                } finally {
                  setImporting(false);
                }
              }}
            >
              {importing ? "Importing..." : "Import"}
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Paste your Devpost event page URL. We&apos;ll fetch details and prefill this form using AI.
          </p>
        </div>
      </div>

      {/* Archive Section */}
      <div className="mt-8 border-t pt-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <p className="font-semibold text-orange-600">
              {event.visibility === EventVisibility.Archived
                ? "Unarchive Event"
                : "Archive Event"}
            </p>
            <p className="text-sm text-muted-foreground">
              {event.visibility === EventVisibility.Archived
                ? "Make this event editable again and restore it to private visibility."
                : "Archive this event to prevent further editing while keeping it visible."}
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                disabled={archiving}
                className="shrink-0 whitespace-nowrap w-full sm:w-auto"
              >
                {archiving
                  ? event.visibility === EventVisibility.Archived
                    ? "Unarchiving..."
                    : "Archiving..."
                  : event.visibility === EventVisibility.Archived
                    ? "Unarchive"
                    : "Archive"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {event.visibility === EventVisibility.Archived
                    ? "Unarchive this event?"
                    : "Archive this event?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {event.visibility === EventVisibility.Archived
                    ? "This will make the event editable again and change its visibility to private. You can change the visibility afterwards if needed."
                    : "Archived events are hidden from non-organizers and the public, and cannot be edited by organizers. You can unarchive it later if needed."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleArchiveToggle}>
                  {event.visibility === EventVisibility.Archived
                    ? "Confirm Unarchive"
                    : "Confirm Archive"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Danger zone */}
      <div className="mt-8 border-t pt-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <p className="font-semibold text-red-600">Delete Event</p>
            <p className="text-sm text-muted-foreground">
              This action cannot be undone.
            </p>
          </div>
          <div className="w-full sm:w-auto flex flex-col gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  disabled={deleting}
                  className="shrink-0 whitespace-nowrap w-full sm:w-auto"
                >
                  {deleting ? "Deleting..." : "Delete Event"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this event?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove the event and related data
                    (tickets, payments, tracks, feedback). This cannot be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      try {
                        setDeleting(true);
                        const res = await fetch(`/api/events/${event.event_id}`, {
                          method: "DELETE",
                        });
                        if (!res.ok) {
                          const body = await res.json().catch(() => ({}));
                          throw new Error(
                            body?.error || "Failed to delete event"
                          );
                        }
                        toast({ title: "Event deleted" });
                        // Navigate back to events list
                        router.push("/events");
                      } catch (err) {
                        console.error(err);
                        toast({
                          title: "Error",
                          description: (err as Error).message,
                          variant: "destructive",
                        });
                      } finally {
                        setDeleting(false);
                      }
                    }}
                  >
                    Confirm Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Duplicate Event (shown under Delete Event button) */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  disabled={duplicating}
                  className="shrink-0 whitespace-nowrap w-full sm:w-auto"
                >
                  {duplicating ? "Duplicating..." : "Duplicate Event"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Duplicate this event?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will create a new draft copy of this event with the
                    same overview settings (and tracks/prizes). Participants,
                    projects, tickets, and payments will not be copied.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      try {
                        setDuplicating(true);
                        const res = await fetch(
                          `/api/events/${event.event_id}/duplicate`,
                          { method: "POST" }
                        );
                        const body = await res.json().catch(() => ({}));
                        if (!res.ok) {
                          throw new Error(body?.error || "Failed to duplicate event");
                        }
                        const created = body?.event;
                        if (!created?.event_id) {
                          throw new Error("Event duplicated but response was missing the new event id");
                        }
                        toast({
                          title: "Event duplicated",
                          description: "Redirecting to your new draft event.",
                        });
                        router.push(
                          `/events/${created?.slug || created?.event_id}/overview`
                        );
                      } catch (err) {
                        console.error(err);
                        toast({
                          title: "Error",
                          description: (err as Error).message,
                          variant: "destructive",
                        });
                      } finally {
                        setDuplicating(false);
                      }
                    }}
                  >
                    Confirm Duplicate
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
}
