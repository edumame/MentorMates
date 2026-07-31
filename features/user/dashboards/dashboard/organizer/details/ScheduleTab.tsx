"use client";

import { useRef, useState, type ComponentProps } from "react";
import { DragDropProvider, useDroppable } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { GripVertical, Trash2, Type, Clock } from "lucide-react";
import { EventDetails, ScheduleDay, ScheduleEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  moveScheduleEvent,
  parseScheduleDragId,
  scheduleDayDropId,
  scheduleEventDragId,
} from "@/lib/utils/schedule";
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

interface SortableEventCardProps {
  scheduleEvent: ScheduleEvent;
  dayIndex: number;
  eventIndex: number;
  disabled: boolean;
  onChange: (patch: Partial<ScheduleEvent>) => void;
  onRemove: () => void;
}

function SortableEventCard({
  scheduleEvent,
  dayIndex,
  eventIndex,
  disabled,
  onChange,
  onRemove,
}: SortableEventCardProps) {
  const { ref, handleRef, isDragSource, isDropTarget } = useSortable({
    id: scheduleEventDragId(dayIndex, eventIndex),
    index: eventIndex,
    group: scheduleDayDropId(dayIndex),
    disabled,
  });

  return (
    <div
      ref={(node) => ref(node)}
      className={cn(
        "rounded-[12px] border border-[rgba(0,0,0,0.15)] bg-[#F7FAFE] p-4 flex flex-col items-start gap-6",
        isDragSource && "opacity-60",
        isDropTarget && "ring-2 ring-[#4b89ef]/60"
      )}
      style={{
        boxShadow:
          "0 0 0 1px rgba(0, 0, 0, 0.05) inset, 0 -2px 1px 0 rgba(0, 0, 0, 0.05) inset, 0 1px 2px 0 rgba(0, 0, 0, 0.05)",
      }}
    >
      <div className="w-full flex items-start justify-between gap-4">
        <button
          ref={(node) => handleRef(node)}
          type="button"
          disabled={disabled}
          className="mt-9 rounded p-1 text-black/45 hover:bg-black/5 hover:text-black/70 disabled:cursor-not-allowed disabled:opacity-40 cursor-grab shrink-0"
          aria-label="Drag to move event"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[16px] font-normal text-black">Event Name</label>
            <div className="relative">
              <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
              <Input
                value={scheduleEvent.name}
                disabled={disabled}
                onChange={(e) => onChange({ name: e.target.value })}
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
                disabled={disabled}
                onChange={(e) => onChange({ time: e.target.value })}
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
          disabled={disabled}
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2 w-full">
        <label className="text-[16px] font-normal text-black">Description (Optional - Markdown Supported)</label>
        <Textarea
          value={scheduleEvent.description || ""}
          disabled={disabled}
          onChange={(e) => onChange({ description: e.target.value || undefined })}
          placeholder="Add optional markdown description for this event..."
          className="min-h-[200px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] p-3 focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none resize-y"
        />
      </div>
    </div>
  );
}

function EmptyDayDropZone({
  dayIndex,
  disabled,
}: {
  dayIndex: number;
  disabled: boolean;
}) {
  const { ref, isDropTarget } = useDroppable({
    id: scheduleDayDropId(dayIndex),
    disabled,
  });

  return (
    <div
      ref={(node) => ref(node)}
      className={cn(
        "rounded-[12px] border-2 border-dashed border-gray-300 p-6 text-center text-sm text-gray-500",
        isDropTarget && "border-[#4b89ef] bg-[#4b89ef]/5 text-[#4b89ef]"
      )}
    >
      Drag an event here, or add one below.
    </div>
  );
}

export function ScheduleTab({
  event,
  setEvent,
  saving,
  setSaving,
  toast,
}: ScheduleTabProps) {
  const { isArchived, checkArchiveStatus } = useEventArchiveStatus(event);
  const [notifyParticipants, setNotifyParticipants] = useState(true);
  // Serializes drag-reorder writes so a slow earlier request cannot overwrite a later one
  const persistQueueRef = useRef<Promise<void>>(Promise.resolve());
  // Reorders are persisted immediately without emailing; "Save Schedule" still notifies for them
  const pendingReorderNotifyRef = useRef(false);

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

      if (
        (hasScheduleChanged || pendingReorderNotifyRef.current) &&
        notifyParticipants
      ) {
        // Only send notification if schedule actually changed
        await handleScheduleUpdateNotification();
      }
      pendingReorderNotifyRef.current = false;
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

  const updateScheduleEvent = (
    dayIndex: number,
    eventIndex: number,
    patch: Partial<ScheduleEvent>
  ) => {
    const newSchedule = event.event_schedule.map((day, di) =>
      di === dayIndex
        ? {
            ...day,
            events: day.events.map((ev, ei) =>
              ei === eventIndex ? { ...ev, ...patch } : ev
            ),
          }
        : day
    );
    setEvent({ ...event, event_schedule: newSchedule });
  };

  const removeScheduleEvent = (dayIndex: number, eventIndex: number) => {
    const newSchedule = event.event_schedule.map((day, di) =>
      di === dayIndex
        ? { ...day, events: day.events.filter((_, ei) => ei !== eventIndex) }
        : day
    );
    setEvent({ ...event, event_schedule: newSchedule });
  };

  const persistScheduleOrder = (newSchedule: ScheduleDay[]) => {
    persistQueueRef.current = persistQueueRef.current.then(async () => {
      const { error } = await supabase
        .from("events")
        .update({ event_schedule: newSchedule })
        .eq("event_id", event.event_id);

      if (error) {
        console.error("Error saving schedule order:", error);
        toast({
          title: "Order not saved",
          description:
            "The new event order could not be saved. Click “Save Schedule” to retry.",
          variant: "destructive",
        });
      } else {
        pendingReorderNotifyRef.current = true;
      }
    });
  };

  const handleDragEnd: NonNullable<
    ComponentProps<typeof DragDropProvider>["onDragEnd"]
  > = (dragEvent) => {
    if (dragEvent.canceled || isArchived) return;

    const from = parseScheduleDragId(dragEvent.operation.source?.id);
    const to = parseScheduleDragId(dragEvent.operation.target?.id);
    if (!from || !to) return;

    const newSchedule = moveScheduleEvent(event.event_schedule, from, to);
    if (newSchedule !== event.event_schedule) {
      setEvent({ ...event, event_schedule: newSchedule });
      persistScheduleOrder(newSchedule);
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
        <DragDropProvider onDragEnd={handleDragEnd}>
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

              {day.events.length === 0 && (
                <EmptyDayDropZone dayIndex={dayIndex} disabled={isArchived} />
              )}

              {day.events.map((scheduleEvent, eventIndex) => (
                <SortableEventCard
                  key={scheduleEventDragId(dayIndex, eventIndex)}
                  scheduleEvent={scheduleEvent}
                  dayIndex={dayIndex}
                  eventIndex={eventIndex}
                  disabled={isArchived}
                  onChange={(patch) =>
                    updateScheduleEvent(dayIndex, eventIndex, patch)
                  }
                  onRemove={() => removeScheduleEvent(dayIndex, eventIndex)}
                />
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
        </DragDropProvider>
      )}

      <div className="flex items-center justify-between gap-4 bg-gray-100 py-3 px-4 rounded-lg">
        <div className="space-y-0.5">
          <Label
            htmlFor="notify-schedule-changes"
            className="text-sm font-medium text-gray-900"
          >
            Notify participants of schedule changes
          </Label>
          <p className="text-sm text-gray-500">
            When on, all participants receive an email notification after you
            save changes to the schedule. Drag-and-drop reorders are saved
            immediately, but the email is only sent when you press Save
            Schedule.
          </p>
        </div>
        <Switch
          id="notify-schedule-changes"
          checked={notifyParticipants}
          onCheckedChange={setNotifyParticipants}
          disabled={isArchived}
        />
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
