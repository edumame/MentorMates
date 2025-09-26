"use client";

import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Delete } from "@mui/icons-material";
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
    <div className="space-y-4">
      {/* Archived Event Warning */}
      {isArchived && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTitle className="text-orange-900">⚠️ Event is Archived</AlertTitle>
          <AlertDescription>
            This event is archived and the schedule cannot be edited. To make changes, you must first unarchive the event.
          </AlertDescription>
        </Alert>
      )}
      {event.event_schedule.map((day, dayIndex) => (
        <div key={dayIndex} className="space-y-4 border-b pb-4 last:border-0">
          <div className="flex justify-between items-center">
            <div className="space-y-2 flex-1">
              <Label>Day Title</Label>
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
              />
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
              <Delete className="h-4 w-4" />
            </Button>
          </div>

          {day.events.map((scheduleEvent, eventIndex) => (
            <div
              key={eventIndex}
              className="space-y-4 border p-4 rounded-lg bg-gray-50"
            >
              <div className="grid grid-cols-[1fr_1fr_auto] gap-4">
                <div className="space-y-2">
                  <Label>Event Name</Label>
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
                  />
                </div>
                <div className="space-y-2">
                  <Label>Time</Label>
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
                  />
                </div>
                <Button
                  variant="destructive"
                  size="icon"
                  className="self-end"
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
                  <Delete className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Description (Optional - Markdown Supported)</Label>
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
                  rows={3}
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
          >
            Add Event
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
      >
        Add Day
      </Button>

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
