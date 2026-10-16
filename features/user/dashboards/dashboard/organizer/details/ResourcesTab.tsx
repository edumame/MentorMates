"use client";

import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Trash2, Type, Link2, Plus } from "lucide-react";
import { EventDetails } from "@/lib/types";
import { toast as ToastType } from "@/lib/hooks/use-toast";
import { useEventArchiveStatus } from "@/lib/hooks/use-event-archive-status";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

interface ResourcesTabProps {
  event: EventDetails;
  setEvent: React.Dispatch<React.SetStateAction<EventDetails | null>>;
  saving: boolean;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  toast: typeof ToastType;
}

export function ResourcesTab({
  event,
  setEvent,
  saving,
  setSaving,
  toast,
}: ResourcesTabProps) {
  const { isArchived, checkArchiveStatus } = useEventArchiveStatus(event);

  const updateResource = (
    index: number,
    partial: Partial<EventDetails["event_resources"][number]>
  ) => {
    const newResources = [...event.event_resources];
    newResources[index] = {
      ...newResources[index],
      ...partial,
    };
    setEvent({
      ...event,
      event_resources: newResources,
    });
  };

  const handleResourcesUpdate = async () => {
    if (!event) return;

    if (!checkArchiveStatus("update the resources")) {
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from("events")
        .update({ event_resources: event.event_resources })
        .eq("event_id", event.event_id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Resources saved successfully",
      });
    } catch (error) {
      console.error("Error updating resources:", error);
      toast({
        title: "Error",
        description: "Failed to save resources",
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
            This event is archived and the resources cannot be edited. To make changes, you must first unarchive the event.
          </AlertDescription>
        </Alert>
      )}
      <Alert className="border-blue-200 bg-blue-50">
        <AlertTitle className="text-blue-900">Resource visibility</AlertTitle>
        <AlertDescription className="text-blue-800">
          Public resources are visible to anyone viewing this event page,
          including people who have not joined yet. Turn on Private for links
          that should only be visible after joining. Use Public for custom
          pre-join links you want everyone to access.
        </AlertDescription>
      </Alert>
      {event.event_resources.length === 0 ? (
        <div className="border-2 border-dashed border-gray-300 rounded-[12px] p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <Link2 className="w-16 h-16 text-gray-400" />
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">×</span>
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-[18px] font-semibold text-black">
                No resource yet
              </h3>
              <p className="text-[14px] text-gray-500 max-w-md">
                Resources will be shown as individual links on the event page.
              </p>
            </div>
            <Button
              variant="outline"
              disabled={isArchived}
              onClick={() => {
                setEvent({
                  ...event,
                  event_resources: [
                    ...event.event_resources,
                    { name: "", link: "", is_private: false },
                  ],
                });
              }}
              className="mt-2 bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white border-0"
            >
              Add resource
            </Button>
          </div>
        </div>
      ) : (
        <>
          {event.event_resources.map((resource, index) => (
            <div
              key={index}
              className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-6 space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_220px_auto] gap-4">
                <div className="space-y-2">
                  <label className="text-[16px] font-normal text-black">Resource Name</label>
                  <div className="relative">
                    <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                    <Input
                      value={resource.name}
                      disabled={isArchived}
                      onChange={(e) => {
                        updateResource(index, { name: e.target.value });
                      }}
                      className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[16px] font-normal text-black">Link</label>
                  <div className="relative">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                    <Input
                      type="url"
                      value={resource.link}
                      disabled={isArchived}
                      onChange={(e) => {
                        updateResource(index, { link: e.target.value });
                      }}
                      className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor={`resource-private-${index}`}
                    className="text-[16px] font-normal text-black"
                  >
                    Visibility
                  </Label>
                  <div className="h-[44px] px-3 border border-[rgba(0,0,0,0.15)] rounded-[12px] flex items-center justify-between">
                    <span className="text-sm text-[rgba(0,0,0,0.7)]">
                      {resource.is_private === true ? "Private" : "Public"}
                    </span>
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor={`resource-private-${index}`}
                        className="text-sm text-[rgba(0,0,0,0.7)]"
                      >
                        Private
                      </Label>
                      <Switch
                        id={`resource-private-${index}`}
                        disabled={isArchived}
                        checked={resource.is_private === true}
                        onCheckedChange={(checked) =>
                          updateResource(index, { is_private: checked })
                        }
                      />
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="self-end text-red-500 hover:text-red-700 hover:bg-red-50"
                  disabled={isArchived}
                  onClick={() => {
                    const newResources = event.event_resources.filter(
                      (_, i) => i !== index
                    );
                    setEvent({ ...event, event_resources: newResources });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            disabled={isArchived}
            onClick={() => {
              setEvent({
                ...event,
                event_resources: [
                  ...event.event_resources,
                  { name: "", link: "", is_private: false },
                ],
              });
            }}
            className="w-full rounded-[12px] border-0 text-black bg-[rgba(0,0,0,0.05)] hover:bg-gray-50 shadow-[0_0_0_1px_rgba(0,0,0,0.05)_inset,0_-2px_1px_0_rgba(0,0,0,0.05)_inset,0_1px_2px_0_rgba(0,0,0,0.05)]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add new resource
          </Button>
        </>
      )}

      <Button
        onClick={handleResourcesUpdate}
        disabled={saving || isArchived}
        className="w-full mt-4"
      >
        {saving ? "Saving..." : "Save Resources"}
      </Button>
    </div>
  );
}
