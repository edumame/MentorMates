"use client";

import { MapPin, ChevronUp, ChevronDown } from "lucide-react";
import { useState } from "react";
import { ScheduleDay, ScheduleEvent, ScheduleParticipant } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ScheduleContentProps {
  schedule: ScheduleDay[];
}

interface ScheduleDayItemProps {
  day: ScheduleDay;
  isOpen: boolean;
  onToggle: () => void;
}

function ScheduleDayItem({ day, isOpen, onToggle }: ScheduleDayItemProps) {
  return (
    <div className="flex flex-col w-full">
      {/* Day Header */}
      <div
        className="flex items-center justify-between py-5 cursor-pointer"
        onClick={onToggle}
      >
        <h2 className="font-semibold text-[24px] leading-[1.4] text-black">
          {day.time}
        </h2>
        {isOpen ? (
          <ChevronUp className="w-6 h-6 text-black" />
        ) : (
          <ChevronDown className="w-6 h-6 text-black" />
        )}
      </div>

      {/* Events */}
      {isOpen && (
        <div className="flex flex-col w-full gap-8">
          {day.events.map((event: ScheduleEvent, idx: number) => (
            <div key={idx} className="flex flex-col w-full">
              {/* Event Header Row */}
              <div className="flex items-center justify-between w-full pb-6">
                <div className="flex items-center gap-6">
                  {/* Time */}
                  <p className="font-normal text-[18px] leading-[1.5] text-black">
                    {event.time}
                  </p>

                  {/* Event Name */}
                  <h3 className="font-semibold text-[22px] leading-[1.4] text-black">
                    {event.name}
                  </h3>

                  {/* In-person badge */}
                  {event.location && (
                    <div className="border border-[rgba(0,0,0,0.15)] rounded-full px-3 py-1">
                      <p className="font-semibold text-[14px] leading-[1.5] text-black">
                        In-person
                      </p>
                    </div>
                  )}
                </div>

                {/* Location */}
                {event.location && (
                  <div className="flex gap-2 items-center">
                    <MapPin className="w-5 h-5 text-black" />
                    <p className="font-normal text-[16px] leading-[1.5] text-black">
                      {event.location}
                    </p>
                  </div>
                )}
              </div>

              {/* Participants */}
              {event.participants && event.participants.length > 0 && (
                <div className="flex flex-wrap gap-8 pb-8 border-b border-[rgba(0,0,0,0.15)]">
                  {event.participants.map((participant: ScheduleParticipant, pIdx: number) => (
                    <div key={pIdx} className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        {participant.avatar && (
                          <AvatarImage src={participant.avatar} alt={participant.name} />
                        )}
                        <AvatarFallback className="bg-gray-200 text-black font-semibold">
                          {participant.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-[16px] leading-[1.5] text-black">
                            {participant.name}
                          </p>
                          <span className="px-2 py-0.5 bg-gray-100 rounded-full text-[12px] font-medium text-gray-700">
                            {participant.role}
                          </span>
                        </div>
                        <p className="font-normal text-[14px] leading-[1.5] text-gray-600">
                          {participant.title}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Description (if no participants) */}
              {event.description && (!event.participants || event.participants.length === 0) && (
                <div className="pb-8 border-b border-[rgba(0,0,0,0.15)]">
                  <p className="font-normal text-[14px] leading-[1.5] text-black">
                    {event.description}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ScheduleContent({ schedule }: ScheduleContentProps) {
  const [openDays, setOpenDays] = useState<Set<number>>(new Set([0]));

  const toggleDay = (index: number) => {
    setOpenDays((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  if (!schedule || schedule.length === 0) {
    return (
      <div className="flex flex-col w-full py-12">
        <p className="font-normal text-[16px] leading-[1.5] text-black text-center">
          No schedule available yet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      {schedule.map((day, index) => (
        <ScheduleDayItem
          key={index}
          day={day}
          isOpen={openDays.has(index)}
          onToggle={() => toggleDay(index)}
        />
      ))}
    </div>
  );
}
