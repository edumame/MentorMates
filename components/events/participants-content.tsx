"use client";

import { useState, useMemo } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EventRole } from "@/lib/types";
import {
  RoleFilterChips,
  computeRoleCounts,
  resolveRoleLabel,
  type RoleFilter,
} from "./role-filter";

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

export function ParticipantsContent({
  participants,
  canViewParticipants,
  showRoleFilter = false,
  eventRoleLabels,
}: ParticipantsContentProps) {
  const [activeFilter, setActiveFilter] = useState<RoleFilter>("all");

  const counts = useMemo(() => computeRoleCounts(participants), [participants]);

  const filtered = useMemo(() => {
    if (activeFilter === "all") return participants;
    return participants.filter((p) => p.role === activeFilter);
  }, [participants, activeFilter]);

  const resolveLabel = (role: RoleFilter) =>
    resolveRoleLabel(role, eventRoleLabels);

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
        <RoleFilterChips
          counts={counts}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          eventRoleLabels={eventRoleLabels}
        />
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
