"use client";

import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Delete } from "@mui/icons-material";
import { EventDetails } from "@/lib/types";
import { toast as ToastType } from "@/lib/hooks/use-toast";
import { useEventArchiveStatus } from "@/lib/hooks/use-event-archive-status";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

interface RulesTabProps {
  event: EventDetails;
  setEvent: React.Dispatch<React.SetStateAction<EventDetails | null>>;
  saving: boolean;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  toast: typeof ToastType;
}

export function RulesTab({
  event,
  setEvent,
  saving,
  setSaving,
  toast,
}: RulesTabProps) {
  const { isArchived, checkArchiveStatus } = useEventArchiveStatus(event);
  const handleRulesUpdate = async () => {
    if (!event) return;

    if (!checkArchiveStatus("update the rules")) {
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from("events")
        .update({ rules: event.rules })
        .eq("event_id", event.event_id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Rules saved successfully",
      });
    } catch (error) {
      console.error("Error updating rules:", error);
      toast({
        title: "Error",
        description: "Failed to save rules",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Archived Event Warning */}
      {isArchived && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTitle className="text-orange-900">⚠️ Event is Archived</AlertTitle>
          <AlertDescription>
            This event is archived and the rules cannot be edited. To make changes, you must first unarchive the event.
          </AlertDescription>
        </Alert>
      )}
      {event.rules.map((rule, ruleIndex) => (
        <div key={ruleIndex} className="space-y-4 border-b pb-4 last:border-0">
          <div className="flex justify-between items-center">
            <div className="space-y-2 flex-1">
              <Label>Section Title</Label>
              <Input
                value={rule.title}
                disabled={isArchived}
                onChange={(e) => {
                  const newRules = [...event.rules];
                  newRules[ruleIndex].title = e.target.value;
                  setEvent({ ...event, rules: newRules });
                }}
              />
            </div>
            <Button
              variant="destructive"
              size="icon"
              className="ml-2"
              disabled={isArchived}
              onClick={() => {
                const newRules = event.rules.filter((_, i) => i !== ruleIndex);
                setEvent({ ...event, rules: newRules });
              }}
            >
              <Delete className="h-4 w-4" />
            </Button>
          </div>

          {rule.items.map((item, itemIndex) => (
            <div key={itemIndex} className="space-y-2 flex items-end gap-2">
              <div className="flex-1">
                <Label>Rule {itemIndex + 1}</Label>
                <Input
                  value={item}
                  disabled={isArchived}
                  onChange={(e) => {
                    const newRules = [...event.rules];
                    newRules[ruleIndex].items[itemIndex] = e.target.value;
                    setEvent({ ...event, rules: newRules });
                  }}
                />
              </div>
              <Button
                variant="destructive"
                size="icon"
                disabled={isArchived}
                onClick={() => {
                  const newRules = [...event.rules];
                  newRules[ruleIndex].items = newRules[ruleIndex].items.filter(
                    (_, i) => i !== itemIndex
                  );
                  setEvent({ ...event, rules: newRules });
                }}
              >
                <Delete className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <Button
            variant="outline"
            disabled={isArchived}
            onClick={() => {
              const newRules = [...event.rules];
              newRules[ruleIndex].items.push("");
              setEvent({ ...event, rules: newRules });
            }}
          >
            Add Rule
          </Button>
        </div>
      ))}

      <Button
        variant="outline"
        disabled={isArchived}
        onClick={() => {
          setEvent({
            ...event,
            rules: [...event.rules, { title: "", items: [""] }],
          });
        }}
      >
        Add Rule Section
      </Button>

      <Button
        onClick={handleRulesUpdate}
        disabled={saving || isArchived}
        className="w-full mt-4"
      >
        {saving ? "Saving..." : "Save Rules"}
      </Button>
    </div>
  );
}
