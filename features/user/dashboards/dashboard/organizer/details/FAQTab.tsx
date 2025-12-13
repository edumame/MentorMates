"use client";

import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EventDetails } from "@/lib/types";
import { toast as ToastType } from "@/lib/hooks/use-toast";
import { useEventArchiveStatus } from "@/lib/hooks/use-event-archive-status";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

interface FAQTabProps {
  event: EventDetails;
  setEvent: React.Dispatch<React.SetStateAction<EventDetails | null>>;
  saving: boolean;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  toast: typeof ToastType;
}

export function FAQTab({
  event,
  setEvent,
  saving,
  setSaving,
  toast,
}: FAQTabProps) {
  const { isArchived } = useEventArchiveStatus(event);
  const handleFAQUpdate = async () => {
    if (!event) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from("events")
        .update({ faq: event.faq || null })
        .eq("event_id", event.event_id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "FAQ saved successfully",
      });
    } catch (error) {
      console.error("Error updating FAQ:", error);
      toast({
        title: "Error",
        description: "Failed to save FAQ",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 w-full min-w-0">
      {isArchived && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTitle className="text-orange-900">⚠️ Event is Archived</AlertTitle>
          <AlertDescription>This event is archived and cannot be edited. To make changes, you must first unarchive the event using the controls below.</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <label className="text-[16px] font-normal text-black">
          Frequently Asked Questions (Markdown Supported)
        </label>
        <Textarea
          value={event.faq || ""}
          onChange={(e) => {
            setEvent({
              ...event,
              faq: e.target.value || undefined,
            });
          }}
          placeholder={`Enter your FAQ in markdown format. Example:

## How do I register for the event?
Simply click the "Join Event" button and follow the instructions.

## What should I bring?
- Your laptop
- A positive attitude
- Any specific hardware if required

## When does registration close?
Registration closes 24 hours before the event starts.`}
          className="min-h-[300px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] p-3 font-mono text-sm focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none resize-y"
          disabled={isArchived}
        />
      </div>

      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h4 className="font-semibold text-blue-900 mb-2">Markdown Tips:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li><code>## Question</code> - Creates a section heading</li>
          <li><code>**bold text**</code> - Makes text bold</li>
          <li><code>*italic text*</code> - Makes text italic</li>
          <li><code>- item</code> - Creates bullet points</li>
          <li><code>[link text](url)</code> - Creates links</li>
        </ul>
      </div>

      <Button
        onClick={handleFAQUpdate}
        disabled={saving || isArchived}
        className="w-full mt-4"
      >
        {saving ? "Saving..." : "Save FAQ"}
      </Button>
    </div>
  );
} 