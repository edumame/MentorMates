"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Participant {
  uid: string;
  display_name: string | null;
}

interface ParticipantsContentProps {
  participants: Participant[];
  canViewParticipants: boolean;
}

export function ParticipantsContent({
  participants,
  canViewParticipants,
}: ParticipantsContentProps) {
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

  if (participants.length === 0) {
    return (
      <div className="flex flex-col flex-1">
        <div className="flex items-center justify-center py-12">
          <p className="font-normal text-[16px] leading-[1.5] text-gray-500">
            No participants yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-white w-full">
      {participants.map((participant, index) => (
        <div
          key={participant.uid}
          className={`flex flex-row gap-4 md:gap-6 items-center py-4 w-full ${
            index !== participants.length - 1 ? 'border-b border-[rgba(0,0,0,0.15)]' : ''
          }`}
        >
          {/* Left: Avatar and Info */}
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
                <p className="font-normal">Participant</p>
              </div>
            </div>
          </div>

          {/* Right: Follow Button (optional - can be removed if not needed) */}
          {/* Uncomment if you want to add follow functionality
          <button className="bg-[var(--brand-primary-hex)] flex gap-2 items-center justify-center px-5 py-2 rounded-xl shadow-sm shrink-0 text-white font-medium text-[16px] leading-[1.5]">
            Follow
          </button>
          */}
        </div>
      ))}
    </div>
  );
}
