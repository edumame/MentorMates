"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { EventSearchInput } from "@/components/ui/event-search-input";
import { useToast } from "@/lib/hooks/use-toast";
import { Calendar, Clock, Type, Users } from "lucide-react";

export type ScheduleEvent = {
  id: string;
  name: string;
  time: string;
  guests: string;
  description: string;
};

export type ScheduleDay = {
  id: string;
  title: string;
  events: ScheduleEvent[];
};

type ScheduleEditorProps = {
  value: ScheduleDay[];
  onChange: (value: ScheduleDay[]) => void;
};

const createId = () => Math.random().toString(36).slice(2);

const createEmptyEvent = (): ScheduleEvent => ({
  id: createId(),
  name: "",
  time: "",
  guests: "",
  description: "",
});

const createEmptyDay = (): ScheduleDay => ({
  id: createId(),
  title: "",
  events: [createEmptyEvent()],
});

export function ScheduleEditor({ value, onChange }: ScheduleEditorProps) {
  const { toast } = useToast();

  // when there is no schedule at all we immediately show the form
  const [isAdding, setIsAdding] = useState(value.length === 0);
  const [draftDay, setDraftDay] = useState<ScheduleDay | null>(
    value.length === 0 ? createEmptyDay() : null
  );

  const startNewDay = () => {
    setDraftDay(createEmptyDay());
    setIsAdding(true);
  };

  const updateDraftEvent = (eventId: string, patch: Partial<ScheduleEvent>) => {
    if (!draftDay) return;
    setDraftDay({
      ...draftDay,
      events: draftDay.events.map((ev) =>
        ev.id === eventId ? { ...ev, ...patch } : ev
      ),
    });
  };

  const addDraftEvent = () => {
    if (!draftDay) return;
    setDraftDay({
      ...draftDay,
      events: [...draftDay.events, createEmptyEvent()],
    });
  };

  const removeDraftEvent = (eventId: string) => {
    if (!draftDay) return;
    setDraftDay({
      ...draftDay,
      events: draftDay.events.filter((ev) => ev.id !== eventId),
    });
  };

  const removeDay = (dayId: string) => {
    const updated = value.filter((d) => d.id !== dayId);
    onChange(updated);

    // if we deleted the last day, go back to empty-state editor
    if (updated.length === 0) {
      setIsAdding(true);
      setDraftDay(createEmptyDay());
    }
  };

  const handleCreateDayFromDraft = () => {
    if (!draftDay) return;

    if (!draftDay.title.trim()) {
      toast({
        title: "Day title required",
        description: "Give this day a title like “Day 1 – Kickoff”.",
        variant: "destructive",
      });
      return;
    }

    const nonEmptyEvents = draftDay.events.filter(
      (ev) =>
        ev.name.trim() ||
        ev.time.trim() ||
        ev.description.trim() ||
        ev.guests.trim()
    );

    if (nonEmptyEvents.length === 0) {
      toast({
        title: "Add at least one event",
        description: "Each day should have at least one scheduled event.",
        variant: "destructive",
      });
      return;
    }

    onChange([...value, { ...draftDay, events: nonEmptyEvents }]);
    setDraftDay(createEmptyDay());
    setIsAdding(false);

    toast({
      title: "Day added",
      description: "Schedule updated with a new day.",
    });
  };

  const handleCancelDraft = () => {
    setDraftDay(null);
    setIsAdding(false);
  };

  return (
    <div className="space-y-6">
      {/* Existing schedule summary */}
      {value.length > 0 && (
        <div className="space-y-3">
          {value.map((day, index) => (
            <div
              key={day.id}
              className="border border-[rgba(0,0,0,0.12)] rounded-[16px] p-4 bg-[#fafbff]"
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-[15px] font-semibold text-gray-900">
                  {`Day ${index + 1}: ${day.title || "Untitled day"}`}
                </p>
                <button
                  type="button"
                  onClick={() => removeDay(day.id)}
                  className="text-xs text-gray-500 hover:text-red-500"
                >
                  Remove day
                </button>
              </div>

              <div className="space-y-2">
                {day.events.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[14px] text-gray-700"
                  >
                    <div className="flex items-center gap-2 min-w-[110px]">
                      <Clock className="w-4 h-4" />
                      <span>{ev.time || "TBD"}</span>
                    </div>
                    <div className="flex-1 font-medium">
                      {ev.name || "Untitled event"}
                    </div>
                    {ev.guests && (
                      <div className="flex items-center gap-1 sm:max-w-[200px] text-gray-500">
                        <Users className="w-4 h-4" />
                        <span className="truncate">{ev.guests}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty-state card when nothing scheduled yet */}
      {value.length === 0 && !isAdding && (
        <div className="border-2 border-dashed border-gray-300 rounded-[12px] p-12 flex flex-col items-center justify-center text-center min-h-[320px]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Calendar className="w-16 h-16 text-gray-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-[18px] font-semibold text-black">
                No schedule yet
              </h3>
              <p className="text-[14px] text-gray-500 max-w-md">
                Add days and events to display a schedule on the event page.
              </p>
            </div>
            <Button
              type="button"
              onClick={startNewDay}
              className="mt-2 bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white"
            >
              Add schedule
            </Button>
          </div>
        </div>
      )}

      {/* Day editor */}
      {isAdding && draftDay && (
        <div className="border border-[rgba(0,0,0,0.12)] rounded-[20px] p-6 bg-white space-y-5">
          <div className="space-y-2">
            <label className="text-[16px] font-normal text-black">
              Day Title
            </label>
            <div className="relative">
              <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
              <Input
                value={draftDay.title}
                onChange={(e) =>
                  setDraftDay({ ...draftDay, title: e.target.value })
                }
                placeholder="e.g. Day 1 – Kickoff & workshops"
                className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
              />
            </div>
          </div>

          {draftDay.events.map((ev, index) => (
            <div
              key={ev.id}
              className="mt-2 rounded-[16px] bg-[#f6f7ff] p-4 space-y-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-semibold text-gray-900">
                  Event {index + 1}
                </p>
                {draftDay.events.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeDraftEvent(ev.id)}
                    className="text-[12px] text-gray-500 hover:text-red-500"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {/* Event name */}
                <div className="space-y-2">
                  <label className="text-[16px] font-normal text-black">
                    Event Name
                  </label>
                  <div className="relative">
                    <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                    <Input
                      value={ev.name}
                      onChange={(e) =>
                        updateDraftEvent(ev.id, { name: e.target.value })
                      }
                      placeholder="Short description shown in the preview card"
                      className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                    />
                  </div>
                </div>

                {/* Time */}
                <div className="space-y-2">
                  <label className="text-[16px] font-normal text-black">
                    Time
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                    <Input
                      value={ev.time}
                      onChange={(e) =>
                        updateDraftEvent(ev.id, { time: e.target.value })
                      }
                      placeholder="11:00 – 12:30 (UTC)"
                      className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none"
                    />
                  </div>
                </div>

                {/* Guests */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[16px] font-normal text-black">
                      Add guests
                    </label>
                    <button
                      type="button"
                      className="text-[14px] text-[#4b89ef] hover:underline"
                    >
                      Invite guest
                    </button>
                  </div>
                  <div className="relative">
                    <EventSearchInput
                      value={ev.guests}
                      onChange={(e) =>
                        updateDraftEvent(ev.id, { guests: e.target.value })
                      }
                      placeholder="Search guests"
                      inputClassName="h-[44px] rounded-[12px] pr-10 text-[16px] placeholder:text-[rgba(0,0,0,0.6)] focus:border-[rgba(0,0,0,0.15)] focus:ring-2 focus:ring-blue-500 sm:text-[16px]"
                      iconWrapperClassName="text-gray-600"
                      rightAdornment={
                        <svg
                          className="h-5 w-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      }
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className="text-[16px] font-normal text-black">
                    Description
                  </label>
                  <Textarea
                    value={ev.description}
                    onChange={(e) =>
                      updateDraftEvent(ev.id, { description: e.target.value })
                    }
                    placeholder="Add long description (markdown supported)"
                    className="min-h-[160px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] p-3 focus:ring-0 focus:ring-offset-0 focus:border-[rgba(0,0,0,0.15)] outline-none resize-y"
                  />
                </div>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-2 pt-4">
            <Button
              type="button"
              className="bg-[#4b89ef] hover:bg-[#4b89ef]/90 text-white"
              onClick={handleCreateDayFromDraft}
            >
              Create
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelDraft}
              className="border border-[rgba(0,0,0,0.15)]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border border-[rgba(0,0,0,0.15)]"
              onClick={addDraftEvent}
            >
              Add event
            </Button>
          </div>
        </div>
      )}

      {/* “Add new day” when you already have a schedule */}
      {value.length > 0 && !isAdding && (
        <Button
          type="button"
          variant="outline"
          className="border border-[rgba(0,0,0,0.15)]"
          onClick={startNewDay}
        >
          + Add new day
        </Button>
      )}
    </div>
  );
}
