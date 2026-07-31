"use client";

import type { ComponentProps } from "react";
import { DragDropProvider, useDroppable } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { Calendar, Tag, Clock, GripVertical, Trash2, Plus } from "lucide-react";
import type { WizardEventData, WizardScheduleDay } from "@/lib/types/wizard";
import { cn } from "@/lib/utils";
import {
  moveScheduleEvent,
  scheduleDayDropId,
  scheduleEventDragId,
} from "@/lib/utils/schedule";
import { getScheduleDragMove } from "@/lib/utils/schedule-dnd";

interface ScheduleEditorProps {
  event: WizardEventData;
  update: (fields: Partial<WizardEventData>) => void;
}

type WizardScheduleEvent = WizardScheduleDay["events"][0];

interface SortableEventRowProps {
  scheduleEvent: WizardScheduleEvent;
  dayIndex: number;
  eventIndex: number;
  onChange: (changes: Partial<WizardScheduleEvent>) => void;
  onRemove: () => void;
}

function SortableEventRow({
  scheduleEvent,
  dayIndex,
  eventIndex,
  onChange,
  onRemove,
}: SortableEventRowProps) {
  const { ref, handleRef, isDragSource, isDropTarget } = useSortable({
    id: scheduleEventDragId(dayIndex, eventIndex),
    index: eventIndex,
    group: scheduleDayDropId(dayIndex),
  });

  return (
    <div
      ref={(node) => ref(node)}
      className={cn(
        "rounded-[12px] border border-[rgba(0,0,0,0.15)] bg-[#F7FAFE] p-4",
        isDragSource && "opacity-60",
        isDropTarget && "ring-2 ring-[#4b89ef]/60"
      )}
      style={{ boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)" }}
    >
      <div className="flex items-start gap-3">
        <button
          ref={(node) => handleRef(node)}
          type="button"
          className="mt-3 rounded p-1 text-black/45 hover:bg-black/5 hover:text-black/70 cursor-grab shrink-0"
          aria-label="Drag to move event"
        >
          <GripVertical className="size-4" />
        </button>
        <div className="flex-1 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="relative">
              <Tag className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={scheduleEvent.name}
                onChange={(e) => onChange({ name: e.target.value })}
                placeholder="Event name"
                className="h-[44px] w-full rounded-[12px] border border-[rgba(0,0,0,0.15)] bg-white pl-11 pr-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
              />
            </div>
            <div className="relative">
              <Clock className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={scheduleEvent.time}
                onChange={(e) => onChange({ time: e.target.value })}
                placeholder="Time (e.g., 10:00 AM)"
                className="h-[44px] w-full rounded-[12px] border border-[rgba(0,0,0,0.15)] bg-white pl-11 pr-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
              />
            </div>
          </div>
          <input
            type="text"
            value={scheduleEvent.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Description (optional)"
            className="h-[44px] w-full rounded-[12px] border border-[rgba(0,0,0,0.15)] bg-white px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
          />
        </div>
        <button
          onClick={onRemove}
          className="mt-2 rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 shrink-0"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}

function EmptyDayDropZone({ dayIndex }: { dayIndex: number }) {
  const { ref, isDropTarget } = useDroppable({
    id: scheduleDayDropId(dayIndex),
  });

  return (
    <div
      ref={(node) => ref(node)}
      className={cn(
        "rounded-[12px] border-2 border-dashed border-gray-200 p-6 text-center text-sm text-gray-500",
        isDropTarget && "border-[#4b89ef] bg-[#4b89ef]/5 text-[#4b89ef]"
      )}
    >
      Drag an event here, or add one below.
    </div>
  );
}

export function ScheduleEditor({ event, update }: ScheduleEditorProps) {
  const addDay = () => {
    update({
      schedule: [
        ...event.schedule,
        {
          date: "",
          events: [{ id: `sched-${Date.now()}-0`, name: "", time: "", description: "" }],
        },
      ],
    });
  };

  const updateDay = (dayIndex: number, changes: Partial<WizardScheduleDay>) => {
    const schedule = event.schedule.map((d, i) =>
      i === dayIndex ? { ...d, ...changes } : d
    );
    update({ schedule });
  };

  const removeDay = (dayIndex: number) => {
    update({ schedule: event.schedule.filter((_, i) => i !== dayIndex) });
  };

  const addEvent = (dayIndex: number) => {
    const schedule = event.schedule.map((d, i) =>
      i === dayIndex
        ? {
            ...d,
            events: [
              ...d.events,
              { id: `sched-${dayIndex}-${Date.now()}`, name: "", time: "", description: "" },
            ],
          }
        : d
    );
    update({ schedule });
  };

  const updateEvent = (
    dayIndex: number,
    eventIndex: number,
    changes: Partial<WizardScheduleEvent>
  ) => {
    const schedule = event.schedule.map((d, di) =>
      di === dayIndex
        ? {
            ...d,
            events: d.events.map((ev, ei) =>
              ei === eventIndex ? { ...ev, ...changes } : ev
            ),
          }
        : d
    );
    update({ schedule });
  };

  const removeEvent = (dayIndex: number, eventIndex: number) => {
    const schedule = event.schedule.map((d, di) =>
      di === dayIndex
        ? { ...d, events: d.events.filter((_, ei) => ei !== eventIndex) }
        : d
    );
    update({ schedule });
  };

  const handleDragEnd: NonNullable<
    ComponentProps<typeof DragDropProvider>["onDragEnd"]
  > = (dragEvent) => {
    if (dragEvent.canceled) return;

    const move = getScheduleDragMove(dragEvent.operation);
    if (!move) return;

    const schedule = moveScheduleEvent(event.schedule, move.from, move.to);
    if (schedule !== event.schedule) {
      update({ schedule });
    }
  };

  return (
    <>
      <div>
        <h2 className="text-[28px] font-semibold text-black tracking-[-0.06em] leading-[1.4]">
          Schedule
        </h2>
        <p className="text-base text-gray-500 mt-1">
          Add days and events to your hackathon schedule. Drag events to
          reorder them or move them between days.
        </p>
      </div>

      <DragDropProvider onDragEnd={handleDragEnd}>
        {event.schedule.map((day, dayIndex) => (
          <div
            key={dayIndex}
            className="rounded-xl border border-gray-200 bg-white p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Day {dayIndex + 1}
              </h3>
              <button
                onClick={() => removeDay(dayIndex)}
                className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="size-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Day Label
                </label>
                <input
                  type="text"
                  value={day.date}
                  onChange={(e) => updateDay(dayIndex, { date: e.target.value })}
                  placeholder="e.g., Saturday, March 15 or 2026-03-15"
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700">
                  Events
                </label>

                {day.events.length === 0 && (
                  <EmptyDayDropZone dayIndex={dayIndex} />
                )}

                {day.events.map((ev, eventIndex) => (
                  <SortableEventRow
                    key={ev.id}
                    scheduleEvent={ev}
                    dayIndex={dayIndex}
                    eventIndex={eventIndex}
                    onChange={(changes) =>
                      updateEvent(dayIndex, eventIndex, changes)
                    }
                    onRemove={() => removeEvent(dayIndex, eventIndex)}
                  />
                ))}

                <button
                  onClick={() => addEvent(dayIndex)}
                  className="flex items-center gap-1.5 rounded-[12px] border border-[#4b89ef] bg-white px-4 py-2.5 text-sm font-medium text-[#4b89ef] transition-colors hover:bg-[#F7FAFE]"
                >
                  <Plus className="size-4" />
                  Add event
                </button>
              </div>
            </div>
          </div>
        ))}
      </DragDropProvider>

      {event.schedule.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
          <Calendar className="mx-auto size-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            No schedule days yet. Add your first day to get started.
          </p>
        </div>
      )}

      <button
        onClick={addDay}
        className="flex items-center gap-1.5 rounded-[12px] bg-[rgba(0,0,0,0.05)] px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-[rgba(0,0,0,0.08)]"
      >
        <Plus className="size-4" />
        Add new day
      </button>
    </>
  );
}
