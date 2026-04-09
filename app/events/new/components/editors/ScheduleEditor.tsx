"use client";

import { Calendar, Tag, Clock, Trash2, Plus } from "lucide-react";
import type { WizardEventData, WizardScheduleDay } from "@/lib/types/wizard";

interface ScheduleEditorProps {
  event: WizardEventData;
  update: (fields: Partial<WizardEventData>) => void;
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
    changes: Partial<WizardScheduleDay["events"][0]>
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

  return (
    <>
      <div>
        <h2 className="text-[28px] font-semibold text-black tracking-[-0.06em] leading-[1.4]">
          Schedule
        </h2>
        <p className="text-base text-gray-500 mt-1">
          Add days and events to your hackathon schedule.
        </p>
      </div>

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
              {day.events.map((ev, eventIndex) => (
                <div
                  key={ev.id}
                  className="rounded-[12px] border border-[rgba(0,0,0,0.15)] bg-[#F7FAFE] p-4"
                  style={{ boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)" }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="relative">
                          <Tag className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            value={ev.name}
                            onChange={(e) =>
                              updateEvent(dayIndex, eventIndex, {
                                name: e.target.value,
                              })
                            }
                            placeholder="Event name"
                            className="h-[44px] w-full rounded-[12px] border border-[rgba(0,0,0,0.15)] bg-white pl-11 pr-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
                          />
                        </div>
                        <div className="relative">
                          <Clock className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            value={ev.time}
                            onChange={(e) =>
                              updateEvent(dayIndex, eventIndex, {
                                time: e.target.value,
                              })
                            }
                            placeholder="Time (e.g., 10:00 AM)"
                            className="h-[44px] w-full rounded-[12px] border border-[rgba(0,0,0,0.15)] bg-white pl-11 pr-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
                          />
                        </div>
                      </div>
                      <input
                        type="text"
                        value={ev.description}
                        onChange={(e) =>
                          updateEvent(dayIndex, eventIndex, {
                            description: e.target.value,
                          })
                        }
                        placeholder="Description (optional)"
                        className="h-[44px] w-full rounded-[12px] border border-[rgba(0,0,0,0.15)] bg-white px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
                      />
                    </div>
                    <button
                      onClick={() => removeEvent(dayIndex, eventIndex)}
                      className="mt-2 rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 shrink-0"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
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
