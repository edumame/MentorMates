"use client";

import { EventDetails, Lesson } from "@/lib/types";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { customMarkdownComponents } from "@/components/markdown/custom-components";
import { markdownRehypePlugins } from "@/components/markdown/plugins";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

interface ContentTabProps {
  event: EventDetails;
  setEvent: React.Dispatch<React.SetStateAction<EventDetails | null>>;
  isArchived?: boolean;
}

export function ContentTab({
  event,
  setEvent,
  isArchived = false,
}: ContentTabProps) {
  const [savingLessons, setSavingLessons] = useState(false);

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

  const saveLessons = async () => {
    if (isArchived) return;
    try {
      setSavingLessons(true);
      const { error } = await supabase
        .from("events")
        .update({ event_lessons: event.event_lessons || [] })
        .eq("event_id", event.event_id);
      if (error) throw error;
    } catch (err) {
      console.error("Error saving lessons", err);
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
                Exclusive Content for Participants
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
      <p className="font-['Inter'] font-normal leading-[1.5] not-italic relative shrink-0 text-[#7f7f7f] text-[16px] w-full">
        *This content is visible only to participants who have joined/paid for
        the event.
      </p>

      {/* Exclusive Lessons Editor */}
      <div className="w-full mt-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-base font-medium">Exclusive Lessons</p>
          <Button variant="outline" disabled={isArchived} onClick={addLesson}>
            Add Lesson
          </Button>
        </div>

        {(event.event_lessons || []).length === 0 && (
          <p className="text-sm text-muted-foreground">No lessons yet.</p>
        )}

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
                <Label>Cover Image URL</Label>
                <Input
                  type="url"
                  value={lesson.cover_image_url}
                  disabled={isArchived}
                  onChange={(e) => updateLesson(index, { cover_image_url: e.target.value })}
                />
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
      </div>
    </div>
  );
}
