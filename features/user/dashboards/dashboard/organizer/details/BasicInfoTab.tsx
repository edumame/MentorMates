"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

interface BasicInfoTabProps {
  event: EventDetails;
  setEvent: React.Dispatch<React.SetStateAction<EventDetails | null>>;
  saving: boolean;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  toast: typeof ToastType;
  router: ReturnType<typeof useRouter>;
}

export function BasicInfoTab({
  event,
  setEvent,
  saving,
  setSaving,
  toast,
  router,
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
  const [devpostUrl, setDevpostUrl] = useState("");
  const [importing, setImporting] = useState(false);

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
          paywall_content: event.paywall_content,
          cover_image_url: coverImageUrl,
          submission_time_start: event.submission_time_start,
          submission_time_cutoff: event.submission_time_cutoff,
          participant_capacity: event.participant_capacity ?? null,
          finalist_recommendation_enabled: event.finalist_recommendation_enabled ?? false,
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
      const action = event.visibility === EventVisibility.Archived ? "unarchive" : "archive";
      
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
      console.error(`Error ${event.visibility === EventVisibility.Archived ? "unarchiving" : "archiving"} event:`, error);
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

  return (
    <div className="flex space-y-4 w-full flex-col">
      {/* Archived Event Warning */}
      {isArchived && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTitle className="text-orange-900">⚠️ Event is Archived</AlertTitle>
          <AlertDescription>
            This event is archived and cannot be edited. To make changes, you must first unarchive the event using the controls below.
          </AlertDescription>
        </Alert>
      )}

      {/* Compact top rows */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="event_name">Event Name</Label>
          <Input
            id="event_name"
            value={event.event_name || ""}
            disabled={isArchived}
            onChange={(e) =>
              setEvent({ ...event, event_name: e.target.value })
            }
          />
        </div>

      <div className="space-y-2">
        <Label htmlFor="participant_capacity">Participant Seat Cap</Label>
        <Input
          id="participant_capacity"
          type="number"
          min={0}
          placeholder="Unlimited"
          disabled={isArchived}
          value={
            typeof event.participant_capacity === "number"
              ? String(event.participant_capacity)
              : ""
          }
          onChange={(e) => {
            const value = e.target.value;
            setEvent({
              ...event,
              participant_capacity:
                value === "" ? null : Math.max(0, parseInt(value, 10) || 0),
            });
          }}
        />
        <p className="text-xs text-gray-500">
          Leave blank for unlimited participants.
        </p>
      </div>
        <div className="space-y-2">
          <Label htmlFor="slug">URL Slug</Label>
          <Input
            id="slug"
            value={event.slug || ""}
            disabled={isArchived}
            onChange={(e) => {
              setEvent({ ...event, slug: e.target.value });
              setUpdateSlug(true);
            }}
            placeholder="url-friendly-event-name"
            className="font-mono text-sm"
          />
          <p className="text-xs text-gray-500">
            URL-friendly identifier for your event (lowercase, hyphens only)
          </p>
        </div>

        {/* Finalist Recommendation Toggle */}
        <div className="space-y-2">
          <Label htmlFor="finalist_recommendation_enabled">Enable finalist recommendation</Label>
          <div className="flex items-center gap-3">
            <Switch
              id="finalist_recommendation_enabled"
              checked={!!event.finalist_recommendation_enabled}
              disabled={isArchived}
              onCheckedChange={(checked) =>
                setEvent({ ...event, finalist_recommendation_enabled: checked })
              }
            />
            <span className="text-sm text-muted-foreground">
              Judges can mark projects as recommended for finals
            </span>
          </div>
        </div>
      </div>

      {/* Import from Devpost */}
      <div className="space-y-2">
        <Label htmlFor="devpost_url">Import from Devpost</Label>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            id="devpost_url"
            type="url"
            placeholder="https://<event>.devpost.com/"
            value={devpostUrl}
            disabled={isArchived || importing}
            onChange={(e) => setDevpostUrl(e.target.value)}
            className="flex-1 min-w-0"
          />
          <Button
            type="button"
            disabled={isArchived || importing || !devpostUrl}
            className="shrink-0 whitespace-nowrap"
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
                  faq: imported.faq ?? event.faq,
                } as typeof event;
                // If tracks are provided, prefill into event.event_tracks with minimal structure
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="event_date">Event Date</Label>
          <Input
            id="event_date"
            type="date"
            value={event.event_date || ""}
            disabled={isArchived}
            onChange={(e) =>
              setEvent({ ...event, event_date: e.target.value })
            }
            className="w-full"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={event.location || ""}
            disabled={isArchived}
            onChange={(e) =>
              setEvent({ ...event, location: e.target.value })
            }
            className="w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="submission_time_start">
            Submission Window Start (UTC)
          </Label>
          <Input
            id="submission_time_start"
            type="datetime-local"
            value={event.submission_time_start?.slice(0, 16) || ""}
            disabled={isArchived}
            onChange={(e) =>
              setEvent({ ...event, submission_time_start: e.target.value })
            }
            className="w-full"
          />
          <p className="text-xs text-gray-500 break-words overflow-hidden">
            {new Date(event.submission_time_start || "").toString()}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="submission_time_cutoff">
            Submission Window End (UTC)
          </Label>
          <Input
            id="submission_time_cutoff"
            type="datetime-local"
            value={event.submission_time_cutoff?.slice(0, 16) || ""}
            disabled={isArchived}
            onChange={(e) =>
              setEvent({ ...event, submission_time_cutoff: e.target.value })
            }
            className="w-full"
          />
          <p className="text-xs text-gray-500 break-words overflow-hidden">
            {new Date(event.submission_time_cutoff || "").toString()}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="event_blurb">Event Blurb</Label>
        <Textarea
          id="event_blurb"
          value={event.event_blurb || ""}
          disabled={isArchived}
          onChange={(e) =>
            setEvent({ ...event, event_blurb: e.target.value })
          }
          rows={2}
          placeholder="A short, catchy description of your event"
          className="resize-none overflow-auto"
        />
      </div>

      {/* Description moved directly under the blurb, inside a navy callout */}
      <div className="space-y-2">
        <Alert className="border-blue-200 bg-blue-50">
          <AlertTitle className="text-blue-900">Important</AlertTitle>
          <AlertDescription>
            This section is really important. Please click the Preview tab to
            confirm formatting and content before saving.
          </AlertDescription>
          <div className="mt-3 space-y-2">
            <Label htmlFor="event_description">Description (Markdown Supported)</Label>
            <Tabs defaultValue="edit" className="w-full">
              <TabsList>
                <TabsTrigger value="edit">Edit</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="edit" className="mt-0">
                <Textarea
                  id="event_description"
                  value={event.event_description || ""}
                  disabled={isArchived}
                  onChange={(e) =>
                    setEvent({
                      ...event,
                      event_description: e.target.value,
                    })
                  }
                  rows={4}
                  className="resize-none overflow-auto"
                />
              </TabsContent>
              <TabsContent value="preview" className="mt-0">
                <div className="prose prose-sm dark:prose-invert max-w-none rounded-md border bg-white p-3 overflow-auto max-h-[400px]">
                  <ReactMarkdown>{event.event_description || ""}</ReactMarkdown>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </Alert>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cover_image">Cover Image</Label>
        <div className="flex items-center gap-2 mb-2">
          <Button
            type="button"
            variant={!useImageUrl ? "default" : "outline"}
            size="sm"
            disabled={isArchived}
            onClick={() => setUseImageUrl(false)}
          >
            Upload File
          </Button>
          <Button
            type="button"
            variant={useImageUrl ? "default" : "outline"}
            size="sm"
            disabled={isArchived}
            onClick={() => setUseImageUrl(true)}
          >
            Use URL
          </Button>
        </div>

        {!useImageUrl ? (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <input
                type="file"
                id="cover_image"
                accept="image/*"
                disabled={isArchived}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSelectedCoverImage(file);
                    // Create preview URL
                    const preview = URL.createObjectURL(file);
                    setPreviewUrl(preview);
                  }
                }}
                className="flex-1 w-full text-base file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              />
              {(selectedCoverImage || event.cover_image_url) && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={isArchived}
                  onClick={() => {
                    setSelectedCoverImage(null);
                    setPreviewUrl(null);
                    setEvent({ ...event, cover_image_url: "" });
                    const fileInput = document.getElementById(
                      "cover_image"
                    ) as HTMLInputElement;
                    if (fileInput) {
                      fileInput.value = "";
                    }
                  }}
                  className="px-2 py-1 hidden md:block shrink-0 whitespace-nowrap"
                >
                  Remove Cover Image
                </Button>
              )}
            </div>
            {(previewUrl || event.cover_image_url) && (
              <div className="space-y-2">
                <img
                  src={previewUrl || event.cover_image_url || ""}
                  alt="Cover preview"
                  className="rounded-md object-cover max-w-full w-[400px] h-[200px]"
                />
                {(selectedCoverImage || event.cover_image_url) && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={isArchived}
                    onClick={() => {
                      setSelectedCoverImage(null);
                      setPreviewUrl(null);
                      setEvent({ ...event, cover_image_url: "" });
                      const fileInput = document.getElementById(
                        "cover_image"
                      ) as HTMLInputElement;
                      if (fileInput) {
                        fileInput.value = "";
                      }
                    }}
                    className="px-2 py-1 md:hidden w-full sm:w-auto whitespace-nowrap"
                  >
                    Remove Cover Image
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Input
              type="url"
              value={event.cover_image_url || ""}
              disabled={isArchived}
              onChange={(e) => {
                setEvent({
                  ...event,
                  cover_image_url: e.target.value,
                });
                setPreviewUrl(e.target.value);
              }}
              placeholder="https://example.com/image.jpg"
              className="min-w-0"
            />
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Cover preview"
                className="rounded-md object-cover max-w-full w-[400px] h-[200px]"
              />
            )}
          </div>
        )}
      </div>

      {/* Description moved above; removed from bottom */}

      <Button
        onClick={handleBasicInfoUpdate}
        disabled={saving || isArchived}
        className="w-full mt-4"
      >
        {saving ? "Saving..." : "Save Basic Information"}
      </Button>

      {/* Archive Section */}
      <div className="mt-8 border-t pt-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <p className="font-semibold text-orange-600">
              {event.visibility === EventVisibility.Archived ? "Unarchive Event" : "Archive Event"}
            </p>
            <p className="text-sm text-muted-foreground">
              {event.visibility === EventVisibility.Archived 
                ? "Make this event editable again and restore it to private visibility."
                : "Archive this event to prevent further editing while keeping it visible."}
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={archiving || isArchived} className="shrink-0 whitespace-nowrap w-full sm:w-auto">
                {archiving 
                  ? (event.visibility === EventVisibility.Archived ? "Unarchiving..." : "Archiving...") 
                  : (event.visibility === EventVisibility.Archived ? "Unarchive" : "Archive")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {event.visibility === EventVisibility.Archived ? "Unarchive this event?" : "Archive this event?"}
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
                  {event.visibility === EventVisibility.Archived ? "Confirm Unarchive" : "Confirm Archive"}
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
            <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleting} className="shrink-0 whitespace-nowrap w-full sm:w-auto">
                {deleting ? "Deleting..." : "Delete Event"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this event?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove the event and related data (tickets, payments, tracks, feedback). This cannot be undone.
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
                        throw new Error(body?.error || "Failed to delete event");
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
        </div>
      </div>
    </div>
  );
} 