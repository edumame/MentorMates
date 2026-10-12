"use client";

import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EventDetails } from "@/lib/types";
import { toast as ToastType } from "@/lib/hooks/use-toast";
import { useEventArchiveStatus } from "@/lib/hooks/use-event-archive-status";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Plus, Trash2, GripVertical } from "lucide-react";

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
  const faqs = event.faq ?? [];

  const updateFaqs = (updated: { question: string; answer: string }[]) => {
    setEvent({
      ...event,
      faq: updated.length > 0 ? updated : undefined,
    });
  };

  const addFaq = () => {
    updateFaqs([...faqs, { question: "", answer: "" }]);
  };

  const removeFaq = (index: number) => {
    updateFaqs(faqs.filter((_, i) => i !== index));
  };

  const updateFaq = (
    index: number,
    field: "question" | "answer",
    value: string
  ) => {
    const updated = faqs.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    updateFaqs(updated);
  };

  const handleFAQSave = async () => {
    if (!event) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from("events")
        .update({ faq: faqs.length > 0 ? faqs : null })
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
          <AlertTitle className="text-orange-900">Event is Archived</AlertTitle>
          <AlertDescription>
            This event is archived and cannot be edited. To make changes, you
            must first unarchive the event using the controls below.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <label className="text-[16px] font-normal text-black">
          Frequently Asked Questions
        </label>
        <p className="text-sm text-gray-500">
          Add questions and answers that participants might have about your
          event.
        </p>
      </div>

      <div className="space-y-4">
        {faqs.map((faq, index) => (
          <div
            key={index}
            className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-4 space-y-3"
          >
            <div className="flex items-start gap-2">
              <GripVertical className="w-5 h-5 text-gray-400 mt-2.5 shrink-0" />
              <div className="flex-1 space-y-3">
                <Input
                  value={faq.question}
                  onChange={(e) => updateFaq(index, "question", e.target.value)}
                  placeholder="Question"
                  className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[8px] text-[16px] font-medium"
                  disabled={isArchived}
                />
                <Textarea
                  value={faq.answer}
                  onChange={(e) => updateFaq(index, "answer", e.target.value)}
                  placeholder="Answer"
                  className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[8px] text-[16px] min-h-[80px] resize-y"
                  disabled={isArchived}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeFaq(index)}
                disabled={isArchived}
                className="shrink-0 text-gray-400 hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        onClick={addFaq}
        disabled={isArchived}
        className="w-full border-dashed"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add FAQ Item
      </Button>

      <Button
        onClick={handleFAQSave}
        disabled={saving || isArchived}
        className="w-full mt-4"
      >
        {saving ? "Saving..." : "Save FAQ"}
      </Button>
    </div>
  );
}
