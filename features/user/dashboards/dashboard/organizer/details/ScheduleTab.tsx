"use client";

import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Type, Clock, Search } from "lucide-react";
import { EventDetails } from "@/lib/types";
import { toast as ToastType } from "@/lib/hooks/use-toast";
import { EMAIL_TYPES } from "@/lib/email_templates/constants";
import { useEventArchiveStatus } from "@/lib/hooks/use-event-archive-status";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

interface ScheduleTabProps {
  event: EventDetails;
  setEvent: React.Dispatch<React.SetStateAction<EventDetails | null>>;
  saving: boolean;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  toast: typeof ToastType;
}

export function ScheduleTab({
  event,
  setEvent,
  saving,
  setSaving,
  toast,
}: ScheduleTabProps) {
  const { isArchived, checkArchiveStatus } = useEventArchiveStatus(event);
  const handleScheduleUpdateNotification = async () => {
    const response = await fetch(
      `/api/email_notification/event/${event.event_id}`,
      {
        method: "POST",
        body: JSON.stringify({
          eventId: event.event_id,
          emailType: EMAIL_TYPES.EVENT_SCHEDULE_UPDATE,
        }),
      }
    );

    if (response.ok) {
      toast({
        title: "Success",
        description: "Schedule update notification sent successfully",
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to send schedule update notification",
      });
    }
  };

  const handleScheduleUpdate = async () => {
    if (!event) return;

    if (!checkArchiveStatus("update the schedule")) {
      return;
    }

    try {
      setSaving(true);

      // Fetch current schedule from database
      const { data: currentData, error: fetchError } = await supabase
        .from("events")
        .select("event_schedule")
        .eq("event_id", event.event_id)
        .single();

      if (fetchError) throw fetchError;

      // Update the schedule
      const { error: updateError } = await supabase
        .from("events")
        .update({ event_schedule: event.event_schedule })
        .eq("event_id", event.event_id);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "Schedule saved successfully",
      });

      // Compare schedules to determine if notification is needed
      const hasScheduleChanged =
        JSON.stringify(currentData.event_schedule) !==
        JSON.stringify(event.event_schedule);

      if (hasScheduleChanged) {
        // Only send notification if schedule actually changed
        await handleScheduleUpdateNotification();
      }
    } catch (error) {
      console.error("Error updating schedule:", error);
      toast({
        title: "Error",
        description: "Failed to save schedule",
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
            This event is archived and the schedule cannot be edited. To make changes, you must first unarchive the event.
          </AlertDescription>
        </Alert>
      )}
      {event.event_schedule.length === 0 ? (
        <div className="border-2 border-dashed border-gray-300 rounded-[12px] p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <Clock className="w-16 h-16 text-gray-400" />
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">×</span>
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-[18px] font-semibold text-black">
                No schedule yet
              </h3>
              <p className="text-[14px] text-gray-500 max-w-md">
                Add day and events to display the event schedule
              </p>
            </div>
            <Button
              variant="outline"
              disabled={isArchived}
              onClick={() => {
                setEvent({
                  ...event,
                  event_schedule: [
                    ...event.event_schedule,
                    {
                      time: "",
                      events: [{ name: "", time: "", description: undefined }],
                    },
                  ],
                });
              }}
              className="mt-2 bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white border-0"
            >
              Add schedule
            </Button>
          </div>
        </div>
      ) : (
        <>
          {event.event_schedule.map((day, dayIndex) => (
            <div key={dayIndex} className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-6 space-y-4">
              <div className="flex justify-between items-center">
                <div className="space-y-2 flex-1">
                  <label className="text-[16px] font-normal text-black">Day Title</label>
                  <div className="relative">
                    <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                    <Input
                      value={day.time}
                      disabled={isArchived}
                      onChange={(e) => {
                        const newSchedule = [...event.event_schedule];
                        newSchedule[dayIndex].time = e.target.value;
                        setEvent({
                          ...event,
                          event_schedule: newSchedule,
                        });
                      }}
                      className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                    />
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="icon"
                  className="ml-2"
                  disabled={isArchived}
                  onClick={() => {
                    const newSchedule = event.event_schedule.filter(
                      (_, i) => i !== dayIndex
                    );
                    setEvent({ ...event, event_schedule: newSchedule });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {day.events.map((scheduleEvent, eventIndex) => (
                <div
                  key={eventIndex}
                  className="rounded-[12px] border border-[rgba(0,0,0,0.15)] bg-[#F7FAFE] p-4 flex flex-col items-start gap-6"
                  style={{
                    boxShadow:
                      "0 0 0 1px rgba(0, 0, 0, 0.05) inset, 0 -2px 1px 0 rgba(0, 0, 0, 0.05) inset, 0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                  }}
                >
                  <div className="w-full flex items-start justify-between gap-4">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[16px] font-normal text-black">Event Name</label>
                        <div className="relative">
                          <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                          <Input
                            value={scheduleEvent.name}
                            disabled={isArchived}
                            onChange={(e) => {
                              const newSchedule = [...event.event_schedule];
                              newSchedule[dayIndex].events[eventIndex].name =
                                e.target.value;
                              setEvent({
                                ...event,
                                event_schedule: newSchedule,
                              });
                            }}
                            className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[16px] font-normal text-black">Time</label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                          <Input
                            value={scheduleEvent.time}
                            disabled={isArchived}
                            onChange={(e) => {
                              const newSchedule = [...event.event_schedule];
                              newSchedule[dayIndex].events[eventIndex].time =
                                e.target.value;
                              setEvent({
                                ...event,
                                event_schedule: newSchedule,
                              });
                            }}
                            placeholder="11-22-33"
                            className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                          />
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      disabled={isArchived}
                      onClick={() => {
                        const newSchedule = [...event.event_schedule];
                        newSchedule[dayIndex].events = newSchedule[
                          dayIndex
                        ].events.filter((_, i) => i !== eventIndex);
                        setEvent({
                          ...event,
                          event_schedule: newSchedule,
                        });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-2 w-full">
                    <label className="text-[16px] font-normal text-black">Description (Optional - Markdown Supported)</label>
                    <Textarea
                      value={scheduleEvent.description || ""}
                      disabled={isArchived}
                      onChange={(e) => {
                        const newSchedule = [...event.event_schedule];
                        newSchedule[dayIndex].events[eventIndex].description =
                          e.target.value || undefined;
                        setEvent({
                          ...event,
                          event_schedule: newSchedule,
                        });
                      }}
                      placeholder="Add optional markdown description for this event..."
                      className="min-h-[200px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] p-3 focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none resize-y"
                    />
                  </div>
                </div>
              ))}

              <Button
                variant="outline"
                disabled={isArchived}
                onClick={() => {
                  const newSchedule = [...event.event_schedule];
                  newSchedule[dayIndex].events.push({
                    name: "",
                    time: "",
                    description: undefined,
                  });
                  setEvent({ ...event, event_schedule: newSchedule });
                }}
                className="border border-[#4b89ef] text-[#4b89ef] bg-white hover:bg-[#4b89ef]/10"
              >
                Add event
              </Button>
            </div>
          ))}

          <Button
            variant="outline"
            disabled={isArchived}
            onClick={() => {
              setEvent({
                ...event,
                event_schedule: [
                  ...event.event_schedule,
                  {
                    time: "",
                    events: [{ name: "", time: "", description: undefined }],
                  },
                ],
              });
            }}
            className="w-full rounded-[12px] border-0 text-black bg-[rgba(0,0,0,0.05)] hover:bg-gray-50 shadow-[0_0_0_1px_rgba(0,0,0,0.05)_inset,0_-2px_1px_0_rgba(0,0,0,0.05)_inset,0_1px_2px_0_rgba(0,0,0,0.05)]"
          >
            Add new day
          </Button>
        </>
      )}

      <div className="flex justify-center items-center text-sm text-gray-500 italic bg-gray-100 py-2 px-4 rounded-lg">
        Editing the schedule will automatically send a notification to all
        participants once the changes are saved.
      </div>

      <Button
        onClick={handleScheduleUpdate}
        disabled={saving || isArchived}
        className="w-full mt-4"
      >
        {saving ? "Saving..." : "Save Schedule"}
      </Button>
    </div>
  );
}
