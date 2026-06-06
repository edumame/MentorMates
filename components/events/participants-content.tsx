"use client";

import { useState, useMemo } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EventRole } from "@/lib/types";

export interface ParticipantWithRole {
  uid: string;
  display_name: string | null;
  role: EventRole;
}

interface ParticipantsContentProps {
  participants: ParticipantWithRole[];
  canViewParticipants: boolean;
  /**
   * When true, render the role filter chips (Organizer / Participant /
   * Mentor / Judge / Admin). Defaults to false for participant-only views.
   */
  showRoleFilter?: boolean;
  eventRoleLabels?: Record<string, string> | null;
}

const FILTER_ORDER: (EventRole | "all")[] = [
  "all",
  EventRole.Organizer,
  EventRole.Participant,
  EventRole.Mentor,
  EventRole.Judge,
  EventRole.Admin,
];

function defaultRoleLabel(role: EventRole | "all"): string {
  if (role === "all") return "All";
  const map: Record<EventRole, string> = {
    [EventRole.Participant]: "Participant",
    [EventRole.Mentor]: "Mentor",
    [EventRole.Judge]: "Judge",
    [EventRole.Organizer]: "Organizer",
    [EventRole.Admin]: "Admin",
  };
  return map[role];
}

export function ParticipantsContent({
  participants,
  canViewParticipants,
  showRoleFilter = false,
  eventRoleLabels,
}: ParticipantsContentProps) {
  const [activeFilter, setActiveFilter] = useState<EventRole | "all">("all");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: participants.length };
    for (const p of participants) c[p.role] = (c[p.role] || 0) + 1;
    return c;
  }, [participants]);

  const filtered = useMemo(() => {
    if (activeFilter === "all") return participants;
    return participants.filter((p) => p.role === activeFilter);
  }, [participants, activeFilter]);

  const resolveLabel = (role: EventRole | "all") => {
    if (role === "all") return defaultRoleLabel("all");
    return eventRoleLabels?.[role] || defaultRoleLabel(role);
  };

  if (!canViewParticipants) {
    return (
      <div className="flex flex-col flex-1">
        <div className="flex items-center justify-center py-12">
          <p className="font-normal text-[16px] leading-[1.5] text-gray-500">
            Join this event to explore the participant list.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-white w-full">
      {showRoleFilter && (
        <div
          role="tablist"
          aria-label="Filter by role"
          className="flex flex-wrap gap-2 py-3 border-b border-[rgba(0,0,0,0.08)] mb-2"
        >
          {FILTER_ORDER.filter(
            (r) => r === "all" || (counts[r] ?? 0) > 0
          ).map((role) => {
            const isActive = activeFilter === role;
            return (
              <button
                key={role}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveFilter(role)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[#4b89ef] text-white"
                    : "bg-[#f2f2f2] text-black hover:bg-[#e5e5e5]"
                }`}
              >
                {resolveLabel(role)}{" "}
                <span
                  className={`ml-1 text-xs font-normal ${
                    isActive ? "text-white/80" : "text-gray-600"
                  }`}
                >
                  {counts[role] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <p className="font-normal text-[16px] leading-[1.5] text-gray-500">
            {showRoleFilter && activeFilter !== "all"
              ? `No ${resolveLabel(activeFilter).toLowerCase()}s yet.`
              : "No participants yet."}
          </p>
        </div>
      ) : (
        filtered.map((participant, index) => (
          <div
            key={`${participant.uid}-${participant.role}`}
            className={`flex flex-row gap-4 md:gap-6 items-center py-4 w-full ${
              index !== filtered.length - 1
                ? "border-b border-[rgba(0,0,0,0.15)]"
                : ""
            }`}
          >
            <div className="flex-1 flex gap-3 items-center min-w-0">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarFallback className="bg-gray-200 text-black font-semibold text-base">
                  {(participant.display_name?.[0] || "?").toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 flex flex-col min-w-0">
                <p className="font-semibold text-[16px] leading-[1.5] text-black truncate">
                  {participant.display_name || "Anonymous Participant"}
                </p>
                <div className="flex gap-2 items-center text-[14px] leading-[1.5] text-black">
                  <p className="font-normal">{resolveLabel(participant.role)}</p>
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
