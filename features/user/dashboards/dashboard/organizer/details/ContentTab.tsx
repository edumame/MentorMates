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
import { Textarea } from "@/components/ui/textarea";
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
  const [loadingContent, setLoadingContent] = useState(false);
  const [uploadingImages, setUploadingImages] = useState<Record<number, boolean>>({});
  const { toast } = useToast();

  // Fetch paywalled content from dedicated table
  useEffect(() => {
    async function fetchPaidContent() {
      setLoadingContent(true);
      try {
        const { data, error } = await supabase
          .from("event_paid_content")
          .select("paywall_content")
          .eq("event_id", event.event_id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching event paid content:", error);
          return;
        }

        setEvent((prev) =>
          prev ? { ...prev, paywall_content: data?.paywall_content ?? "" } : prev
        );
      } catch (err) {
        console.error("Exception fetching paid content:", err);
      } finally {
        setLoadingContent(false);
      }
    }

    fetchPaidContent();
  }, [event.event_id, setEvent]);

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
          setEvent((prev) =>
            prev ? { ...prev, event_lessons: (lessonsData || []) as Lesson[] } : prev
          );
        }
      } catch (err) {
        console.error("Exception fetching lessons:", err);
      } finally {
        setLoadingLessons(false);
      }
    }

    fetchLessons();
  }, [event.event_id, setEvent]); // Only re-fetch when event_id changes

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
      const content = event.paywall_content || "";
      const hasMeaningfulContent = content.trim().length > 0;

      if (hasMeaningfulContent) {
        const { error } = await supabase
          .from("event_paid_content")
          .upsert(
            {
              event_id: event.event_id,
              paywall_content: content,
            },
            { onConflict: "event_id" }
          );

        if (error) {
          console.error("Error saving content:", error);
          throw new Error(`Failed to save content: ${error.message}`);
        }
      } else {
        const { error } = await supabase
          .from("event_paid_content")
          .delete()
          .eq("event_id", event.event_id);

        if (error) {
          console.error("Error clearing content:", error);
          throw new Error(`Failed to clear content: ${error.message}`);
        }
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
    <div className="space-y-4 w-full min-w-0">
      <Tabs defaultValue="edit" className="w-full">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[16px] font-semibold text-black">
              Exclusive Content for Participants
            </h3>
            <TabsList className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-1 h-auto">
              <TabsTrigger
                value="edit"
                className="px-4 py-2 rounded-[8px] text-sm font-normal transition-colors data-[state=active]:bg-white data-[state=active]:border data-[state=active]:border-[rgba(0,0,0,0.15)] data-[state=active]:text-black data-[state=active]:shadow-sm data-[state=inactive]:bg-transparent data-[state=inactive]:text-black data-[state=inactive]:hover:bg-gray-50"
              >
                Edit
              </TabsTrigger>
              <TabsTrigger
                value="preview"
                className="px-4 py-2 rounded-[8px] text-sm font-normal transition-colors data-[state=active]:bg-white data-[state=active]:border data-[state=active]:border-[rgba(0,0,0,0.15)] data-[state=active]:text-black data-[state=active]:shadow-sm data-[state=inactive]:bg-transparent data-[state=inactive]:text-black data-[state=inactive]:hover:bg-gray-50"
              >
                Preview
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="edit" className="mt-0">
            <Textarea
              id="paywall_content"
              value={event.paywall_content || ""}
              disabled={isArchived || loadingContent}
              onChange={(e) =>
                setEvent({ ...event, paywall_content: e.target.value })
              }
              placeholder="Add content (markdown supported)"
              className="min-h-[300px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] p-3 focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none resize-y"
            />
            {loadingContent && (
              <p className="text-xs text-gray-500 mt-2">Loading saved content...</p>
            )}
            <p className="text-xs text-gray-500 italic mt-2">
              *This content is visible only to participants who have joined the event.
            </p>
          </TabsContent>
          <TabsContent value="preview" className="mt-0">
            <div className="min-h-[300px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] p-3 overflow-auto prose prose-sm max-w-full">
              {event.paywall_content ? (
                <ReactMarkdown
                  rehypePlugins={markdownRehypePlugins}
                  components={customMarkdownComponents}
                >
                  {event.paywall_content}
                </ReactMarkdown>
              ) : (
                <em>No exclusive content added yet.</em>
              )}
            </div>
          </TabsContent>
        </div>
      </Tabs>
      <Button onClick={saveContent} disabled={isArchived || savingContent} className="w-full">
        {savingContent ? "Saving Content..." : "Save Content"}
      </Button>

      {/* Lessons Editor */}
      <div className="w-full mt-4 space-y-4">
        <Tabs defaultValue="edit" className="w-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[16px] font-semibold text-black">
              Lessons {loadingLessons && <span className="text-sm text-gray-500">(Loading...)</span>}
            </h3>
            <div className="flex items-center gap-2">
              <TabsList className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-1 h-auto">
                <TabsTrigger 
                  value="edit"
                  className="px-4 py-2 rounded-[8px] text-sm font-normal transition-colors data-[state=active]:bg-white data-[state=active]:border data-[state=active]:border-[rgba(0,0,0,0.15)] data-[state=active]:text-black data-[state=active]:shadow-sm data-[state=inactive]:bg-transparent data-[state=inactive]:text-black data-[state=inactive]:hover:bg-gray-50"
                >
                  Edit
                </TabsTrigger>
                <TabsTrigger 
                  value="preview"
                  className="px-4 py-2 rounded-[8px] text-sm font-normal transition-colors data-[state=active]:bg-white data-[state=active]:border data-[state=active]:border-[rgba(0,0,0,0.15)] data-[state=active]:text-black data-[state=active]:shadow-sm data-[state=inactive]:bg-transparent data-[state=inactive]:text-black data-[state=inactive]:hover:bg-gray-50"
                >
                  Preview
                </TabsTrigger>
              </TabsList>
              <Button 
                variant="outline" 
                disabled={isArchived || loadingLessons} 
                onClick={addLesson}
                className="border border-[rgba(0,0,0,0.15)] bg-white"
              >
                Add Lesson
              </Button>
            </div>
          </div>

          <TabsContent value="edit" className="mt-0">
            {loadingLessons ? (
              <p className="text-sm text-gray-500">Loading lessons...</p>
            ) : (event.event_lessons || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No lessons yet. Click &quot;Add Lesson&quot; to create one.</p>
            ) : null}

        <div className="space-y-6">
          {(event.event_lessons || []).map((lesson, index) => (
            <div key={index} className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[16px] font-normal text-black">Title</label>
                  <Input
                    value={lesson.title}
                    disabled={isArchived}
                    onChange={(e) => updateLesson(index, { title: e.target.value })}
                    className="h-[44px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[16px] font-normal text-black">Duration (minutes)</label>
                  <Input
                    type="number"
                    min={1}
                    value={Number(lesson.duration_minutes) || 0}
                    disabled={isArchived}
                    onChange={(e) =>
                      updateLesson(index, { duration_minutes: Math.max(1, parseInt(e.target.value || "0", 10)) })
                    }
                    className="h-[44px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px]"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[16px] font-normal text-black">Cover Image</label>
                <div className="flex gap-2">
                  <Input
                    type="url"
                    placeholder="Image URL"
                    value={lesson.cover_image_url}
                    disabled={isArchived || uploadingImages[index]}
                    onChange={(e) => updateLesson(index, { cover_image_url: e.target.value })}
                    className="flex-1 h-[44px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px]"
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
                      className="h-[44px] border border-[rgba(0,0,0,0.15)] bg-white"
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
                      className="w-32 h-20 object-cover rounded-[12px] border border-[rgba(0,0,0,0.15)]"
                    />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-[16px] font-normal text-black">Destination URL</label>
                <Input
                  type="url"
                  value={lesson.url}
                  disabled={isArchived}
                  onChange={(e) => updateLesson(index, { url: e.target.value })}
                  className="h-[44px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[16px] font-normal text-black">Description</label>
                <Textarea
                  value={lesson.description}
                  disabled={isArchived}
                  onChange={(e) => updateLesson(index, { description: e.target.value })}
                  className="min-h-[100px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] p-3"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button 
                  variant="destructive" 
                  disabled={isArchived} 
                  onClick={() => removeLesson(index)}
                  className="border border-[rgba(0,0,0,0.15)]"
                >
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
