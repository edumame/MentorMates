"use client";

import { EventDetails, Lesson } from "@/lib/types";
import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { customMarkdownComponents } from "@/components/markdown/custom-components";
import { markdownRehypePlugins } from "@/components/markdown/plugins";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/lib/hooks/use-toast";

interface ContentTabProps {
  event: EventDetails;
  setEvent: React.Dispatch<React.SetStateAction<EventDetails | null>>;
  isArchived?: boolean;
  refetchEvent?: () => void;
}

export function ContentTab({
  event,
  setEvent,
  isArchived = false,
  refetchEvent,
}: ContentTabProps) {
  const [savingLessons, setSavingLessons] = useState(false);
  const [savingContent, setSavingContent] = useState(false);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [uploadingImages, setUploadingImages] = useState<Record<number, boolean>>({});
  const { toast } = useToast();

  // Fetch lessons from database when component mounts
  useEffect(() => {
    async function fetchLessons() {
      setLoadingLessons(true);
      try {
        const { data: lessonsData, error } = await supabase
          .from("event_lessons")
          .select("title,cover_image_url,url,description,duration_minutes")
          .eq("event_id", event.event_id);

        if (error) {
          console.error("Error fetching lessons:", error);
        } else {
          // Update event with fetched lessons
          setEvent({ ...event, event_lessons: (lessonsData || []) as Lesson[] });
        }
      } catch (err) {
        console.error("Exception fetching lessons:", err);
      } finally {
        setLoadingLessons(false);
      }
    }

    fetchLessons();
  }, [event.event_id]); // Only re-fetch when event_id changes

  const addLesson = () => {
    const newLesson: Lesson = {
      title: "",
      cover_image_url: "",
      url: "",
      description: "",
      duration_minutes: 5,
    };
    setEvent({ ...event, event_lessons: [...(event.event_lessons || []), newLesson] });
  };

  const updateLesson = (index: number, updates: Partial<Lesson>) => {
    const next = [...(event.event_lessons || [])];
    next[index] = { ...next[index], ...updates } as Lesson;
    setEvent({ ...event, event_lessons: next });
  };

  const removeLesson = (index: number) => {
    const next = (event.event_lessons || []).filter((_, i) => i !== index);
    setEvent({ ...event, event_lessons: next });
  };

  const handleImageUpload = async (index: number, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Please upload an image file (PNG, JPG, GIF, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Image size must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploadingImages(prev => ({ ...prev, [index]: true }));

      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('eventId', event.event_id);

      // Upload to your API endpoint
      const response = await fetch('/api/upload-lesson-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();

      // Update lesson with the uploaded image URL
      updateLesson(index, { cover_image_url: data.url });

      toast({
        title: "Success",
        description: "Image uploaded successfully",
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Error",
        description: "Failed to upload image. Please try again or use a URL instead.",
        variant: "destructive",
      });
    } finally {
      setUploadingImages(prev => ({ ...prev, [index]: false }));
    }
  };

  const saveContent = async () => {
    if (isArchived) return;
    try {
      setSavingContent(true);
      const { error } = await supabase
        .from("events")
        .update({ paywall_content: event.paywall_content })
        .eq("event_id", event.event_id);

      if (error) {
        console.error("Error saving content:", error);
        throw new Error(`Failed to save content: ${error.message}`);
      }

      toast({
        title: "Success",
        description: "Exclusive content saved successfully",
      });
    } catch (err) {
      console.error("Error saving content", err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save content. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingContent(false);
    }
  };

  const saveLessons = async () => {
    if (isArchived) return;

    try {
      setSavingLessons(true);
      const eventId = event.event_id;
      const lessons = event.event_lessons || [];

      // Validate lessons before saving
      const invalidLessons = lessons.filter(
        (l) => !l.title?.trim() || !l.cover_image_url?.trim() || !l.url?.trim() || !l.description?.trim() || !l.duration_minutes || l.duration_minutes < 1
      );

      if (invalidLessons.length > 0) {
        throw new Error("All lesson fields are required. Please fill in title, cover image URL, URL, description, and duration (minimum 1 minute) for all lessons.");
      }

      // Delete existing lessons for this event
      const { error: delErr } = await supabase
        .from("event_lessons")
        .delete()
        .eq("event_id", eventId);

      if (delErr) {
        throw new Error(`Failed to delete existing lessons: ${delErr.message}`);
      }

      // Insert new lessons
      if (lessons.length > 0) {
        const payload = lessons.map((l) => ({
          event_id: eventId,
          title: l.title.trim(),
          cover_image_url: l.cover_image_url.trim(),
          url: l.url.trim(),
          description: l.description.trim(),
          duration_minutes: l.duration_minutes,
        }));

        const { error: insErr } = await supabase
          .from("event_lessons")
          .insert(payload)
          .select();

        if (insErr) {
          throw new Error(`Failed to insert lessons: ${insErr.message}`);
        }
      }

      toast({
        title: "Success",
        description: `${lessons.length} lesson${lessons.length !== 1 ? 's' : ''} saved successfully`,
      });

      // Refetch event data to ensure lessons persist across navigation
      if (refetchEvent) {
        refetchEvent();
      }
    } catch (err) {
      console.error("Error saving lessons", err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save lessons. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingLessons(false);
    }
  };

  return (
    <div className="content-stretch flex flex-col gap-[16px] items-start w-full">
      <div className="content-stretch flex gap-[24px] items-start relative shrink-0 w-full">
        <div className="basis-0 content-stretch flex flex-col gap-[8px] grow items-start min-h-px min-w-px relative shrink-0">
          <Tabs defaultValue="edit" className="w-full">
            <div className="content-stretch flex items-center justify-between relative shrink-0 w-full">
              <p className="font-['Inter'] font-normal leading-[1.5] not-italic relative shrink-0 text-[16px] text-black text-nowrap whitespace-pre">
                Content for Event Participants
              </p>
              <TabsList className="bg-white border border-[rgba(0,0,0,0.15)] border-solid flex items-start relative rounded-[12px] shrink-0 h-auto gap-0">
                <TabsTrigger value="edit">Edit</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="edit" className="mt-4">
              <div className="bg-white border border-[rgba(0,0,0,0.15)] border-solid box-border content-stretch flex gap-[12px] h-[299px] items-start px-[12px] py-[8px] relative rounded-[12px] shrink-0 w-full">
                <textarea
                  id="paywall_content"
                  value={event.paywall_content || ""}
                  disabled={isArchived}
                  onChange={(e) =>
                    setEvent({ ...event, paywall_content: e.target.value })
                  }
                  placeholder="Add content (markdown supported)"
                  className="p-4 basis-0 font-['Inter'] font-normal grow leading-[1.5] min-h-px min-w-px not-italic relative shrink-0 text-[16px] text-[rgba(0,0,0,0.6)] bg-transparent border-none outline-none focus:outline-none resize-none"
                />
              </div>
            </TabsContent>

            <TabsContent value="preview" className="mt-4">
              <div className="bg-white border border-[rgba(0,0,0,0.15)] border-solid box-border content-stretch flex gap-[12px] min-h-[299px] items-start px-[12px] py-[8px] relative rounded-[12px] shrink-0 w-full">
                <div className="p-4 prose prose-sm dark:prose-invert max-w-none basis-0 font-['Inter'] font-normal grow leading-[1.5] min-h-px min-w-px not-italic relative shrink-0 text-[16px] text-black">
                  <ReactMarkdown
                    rehypePlugins={markdownRehypePlugins}
                    components={customMarkdownComponents}
                  >
                    {event.paywall_content ||
                      "Add content (markdown supported)"}
                  </ReactMarkdown>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <Button onClick={saveContent} disabled={isArchived || savingContent} className="w-full">
        {savingContent ? "Saving Content..." : "Save Content"}
      </Button>
      <p className="font-['Inter'] font-normal leading-[1.5] not-italic relative shrink-0 text-[#7f7f7f] text-[16px] w-full">
        *This content is visible only to participants who have joined/paid for
        the event.
      </p>

      {/* Lessons Editor */}
      <div className="w-full mt-4 space-y-4">
        <Tabs defaultValue="edit" className="w-full">
          <div className="flex items-center justify-between mb-4">
            <p className="text-base font-medium">
              Lessons {loadingLessons && <span className="text-sm text-gray-500">(Loading...)</span>}
            </p>
            <div className="flex items-center gap-2">
              <TabsList className="bg-white border border-[rgba(0,0,0,0.15)] border-solid flex items-start relative rounded-[12px] shrink-0 h-auto gap-0">
                <TabsTrigger value="edit">Edit</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              <Button variant="outline" disabled={isArchived || loadingLessons} onClick={addLesson}>
                Add Lesson
              </Button>
            </div>
          </div>

          <TabsContent value="edit" className="mt-0">
            {loadingLessons ? (
              <p className="text-sm text-gray-500">Loading lessons...</p>
            ) : (event.event_lessons || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No lessons yet. Click "Add Lesson" to create one.</p>
            ) : null}

        <div className="space-y-6">
          {(event.event_lessons || []).map((lesson, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={lesson.title}
                  disabled={isArchived}
                  onChange={(e) => updateLesson(index, { title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Cover Image</Label>
                <div className="flex gap-2">
                  <Input
                    type="url"
                    placeholder="Image URL"
                    value={lesson.cover_image_url}
                    disabled={isArchived || uploadingImages[index]}
                    onChange={(e) => updateLesson(index, { cover_image_url: e.target.value })}
                    className="flex-1"
                  />
                  <div className="relative">
                    <Input
                      type="file"
                      accept="image/*"
                      disabled={isArchived || uploadingImages[index]}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleImageUpload(index, file);
                        }
                      }}
                      className="hidden"
                      id={`file-upload-${index}`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isArchived || uploadingImages[index]}
                      onClick={() => document.getElementById(`file-upload-${index}`)?.click()}
                    >
                      {uploadingImages[index] ? "Uploading..." : "Upload"}
                    </Button>
                  </div>
                </div>
                {lesson.cover_image_url && (
                  <div className="mt-2">
                    <img
                      src={lesson.cover_image_url}
                      alt="Preview"
                      className="w-32 h-20 object-cover rounded border"
                    />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Destination URL</Label>
                <Input
                  type="url"
                  value={lesson.url}
                  disabled={isArchived}
                  onChange={(e) => updateLesson(index, { url: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  min={1}
                  value={Number(lesson.duration_minutes) || 0}
                  disabled={isArchived}
                  onChange={(e) =>
                    updateLesson(index, { duration_minutes: Math.max(1, parseInt(e.target.value || "0", 10)) })
                  }
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label>Description</Label>
                <Input
                  value={lesson.description}
                  disabled={isArchived}
                  onChange={(e) => updateLesson(index, { description: e.target.value })}
                />
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <Button variant="destructive" disabled={isArchived} onClick={() => removeLesson(index)}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>

        {isArchived && (
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTitle className="text-orange-900">⚠️ Event is Archived</AlertTitle>
            <AlertDescription>
              Lessons cannot be edited while the event is archived.
            </AlertDescription>
          </Alert>
        )}

        <Button onClick={saveLessons} disabled={isArchived || savingLessons} className="w-full">
          {savingLessons ? "Saving Lessons..." : "Save Lessons"}
        </Button>
          </TabsContent>

          <TabsContent value="preview" className="mt-0">
            {(event.event_lessons || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No lessons to preview. Add lessons in the Edit tab.</p>
            ) : (
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  This is how your lessons will appear to participants on the event page and Learn tab:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {(event.event_lessons || []).map((lesson, idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col hover:shadow-md hover:border-gray-300 transition-all duration-200"
                    >
                      <div className="relative w-full aspect-video bg-black rounded-t-xl overflow-hidden">
                        {lesson.cover_image_url ? (
                          <img
                            src={lesson.cover_image_url}
                            alt={lesson.title}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
                            No image
                          </div>
                        )}
                      </div>
                      <div className="p-4 flex-1 flex flex-col">
                        <h4 className="text-base font-semibold mb-1">{lesson.title || "Untitled"}</h4>
                        <p className="text-sm text-gray-600 mb-4 line-clamp-3">{lesson.description || "No description"}</p>
                        <div className="mt-auto text-xs text-gray-500 flex items-center gap-1">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            fill="none"
                            viewBox="0 0 24 24"
                            className="inline-block"
                          >
                            <path
                              d="M12 8V12L14.5 13.5M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          {lesson.duration_minutes} min
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
