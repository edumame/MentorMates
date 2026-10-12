"use client";

import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Type, Plus } from "lucide-react";
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
    <div className="space-y-4 w-full min-w-0">
      {/* Archived Event Warning */}
      {isArchived && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTitle className="text-orange-900">⚠️ Event is Archived</AlertTitle>
          <AlertDescription>
            This event is archived and the rules cannot be edited. To make changes, you must first unarchive the event.
          </AlertDescription>
        </Alert>
      )}
      {event.rules.length === 0 ? (
        <div className="border-2 border-dashed border-gray-300 rounded-[12px] p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <Type className="w-16 h-16 text-gray-400" />
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">×</span>
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-[18px] font-semibold text-black">
                No Rules yet
              </h3>
              <p className="text-[14px] text-gray-500 max-w-md">
                Rules will be shown under the overview tab on the event page.
              </p>
            </div>
            <Button
              variant="outline"
              disabled={isArchived}
              onClick={() => {
                setEvent({
                  ...event,
                  rules: [...event.rules, { title: "", items: [""] }],
                });
              }}
              className="mt-2 bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white border-0"
            >
              Add rules
            </Button>
          </div>
        </div>
      ) : (
        <>
          {event.rules.map((rule, ruleIndex) => (
            <div key={ruleIndex} className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-6 space-y-4">
              <div className="flex justify-between items-center">
                <div className="space-y-2 flex-1">
                  <label className="text-[16px] font-normal text-black">Section Title</label>
                  <div className="relative">
                    <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                    <Input
                      value={rule.title}
                      disabled={isArchived}
                      onChange={(e) => {
                        const newRules = [...event.rules];
                        newRules[ruleIndex].title = e.target.value;
                        setEvent({ ...event, rules: newRules });
                      }}
                      className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                    />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                  disabled={isArchived}
                  onClick={() => {
                    const newRules = event.rules.filter((_, i) => i !== ruleIndex);
                    setEvent({ ...event, rules: newRules });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {rule.items.map((item, itemIndex) => (
                <div key={itemIndex} className="space-y-2 flex items-end gap-2">
                  <div className="flex-1">
                    <label className="text-[16px] font-normal text-black">Rule {itemIndex + 1}</label>
                    <div className="relative">
                      <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                      <Input
                        value={item}
                        disabled={isArchived}
                        onChange={(e) => {
                          const newRules = [...event.rules];
                          newRules[ruleIndex].items[itemIndex] = e.target.value;
                          setEvent({ ...event, rules: newRules });
                        }}
                        className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    disabled={isArchived}
                    onClick={() => {
                      const newRules = [...event.rules];
                      newRules[ruleIndex].items = newRules[ruleIndex].items.filter(
                        (_, i) => i !== itemIndex
                      );
                      setEvent({ ...event, rules: newRules });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
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
                className="border border-[#4b89ef] text-[#4b89ef] bg-white hover:bg-[#4b89ef]/10"
              >
                Add rule
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
            className="w-full rounded-[12px] border-0 text-black bg-[rgba(0,0,0,0.05)] hover:bg-gray-50 shadow-[0_0_0_1px_rgba(0,0,0,0.05)_inset,0_-2px_1px_0_rgba(0,0,0,0.05)_inset,0_1px_2px_0_rgba(0,0,0,0.05)]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add new section
          </Button>
        </>
      )}

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
