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
    <div className="space-y-4">
      <div className="space-y-2">
        {isArchived && (
          <div className="mt-2 py-4">
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTitle className="text-orange-900">⚠️ Event is Archived</AlertTitle>
              <AlertDescription>This event is archived and cannot be edited. To make changes, you must first unarchive the event using the controls below.</AlertDescription>
            </Alert>
          </div>
        )}
        <Label>Frequently Asked Questions (Markdown Supported)</Label>
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
          rows={15}
          className="font-mono text-sm"
          disabled={isArchived}
        />
      </div>

      <div className="bg-blue-50 p-4 rounded-lg">
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