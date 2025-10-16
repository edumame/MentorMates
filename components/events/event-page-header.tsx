"use client";

import { CalendarDays, MapPin, Ticket, ChevronRight } from "lucide-react";

interface EventPageHeaderProps {
  eventName: string;
  eventBlurb: string;
  eventDate: string;
  location: string;
  coverImageUrl?: string;
  eventId: string;
  hasJoined: boolean;
}

export function EventPageHeader({
  eventName,
  eventBlurb,
  eventDate,
  location,
  coverImageUrl,
  hasJoined,
}: EventPageHeaderProps) {
  // Format date
  const formattedDate = new Date(eventDate).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="bg-white border-b border-[#f2f2f2] flex flex-col w-full">
      {/* Cover Image */}
      <div className="h-[240px] w-full relative overflow-hidden">
        {coverImageUrl ? (
          <>
            <img
              src={coverImageUrl}
              alt={eventName}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Hide broken image and show gradient background
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-[#1e3a8a] to-[#3c73bd] -z-10" />
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-[#1e3a8a] to-[#3c73bd]" />
        )}

        {/* Event Tags - Positioned on cover image */}
        <div className="absolute left-6 bottom-6 flex flex-wrap gap-1 z-10">
          <div className="bg-white border border-[rgba(0,0,0,0.15)] px-2.5 py-1 rounded-full">
            <p className="font-semibold text-sm leading-[1.5] text-black whitespace-nowrap">
              Hackathon
            </p>
          </div>
          <div className="bg-white border border-[rgba(0,0,0,0.15)] px-2.5 py-1 rounded-full">
            <p className="font-semibold text-sm leading-[1.5] text-black whitespace-nowrap">
              Free
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="w-full px-6 pt-6 pb-0">
        <div className="flex items-start justify-between w-full gap-6">
          {/* Left: Event Info */}
          <div className="flex flex-col gap-2 max-w-[617px]">
            <div className="flex flex-col gap-2">
              <h1 className="font-semibold text-[28px] leading-[1.4] tracking-[-0.06em] text-black">
                {eventName}
              </h1>
              <p className="font-normal text-base leading-[1.5] text-black line-clamp-3">
                {eventBlurb}
              </p>
            </div>

            {/* Organization Badge - TODO: Add event creator/organization display in the future */}
            {/* <div className="flex gap-1 items-center">
              <div className="flex gap-1 items-center">
                <div className="w-7 h-7 rounded-full bg-gray-300" />
                <p className="font-normal text-sm text-[#191919]">
                  HerWorkspace
                </p>
              </div>
              <ChevronRight className="w-6 h-6 text-black" />
            </div> */}
          </div>

          {/* Right: Join Button and Meta */}
          <div className="flex flex-col gap-3 items-end justify-center w-[411px]">
            <div className="flex gap-4 items-center justify-center">
              {!hasJoined ? (
                <div className="bg-[#4b89ef] flex gap-1.5 items-center justify-center px-5 py-2 rounded-xl shadow-sm w-[341px]">
                  <Ticket className="w-6 h-6 text-white" />
                  <span className="font-medium text-base text-white">
                    Join {eventName}
                  </span>
                </div>
              ) : (
                <div className="bg-green-500 flex gap-1.5 items-center justify-center px-5 py-2 rounded-xl shadow-sm w-[341px]">
                  <span className="font-medium text-base text-white">
                    Joined
                  </span>
                </div>
              )}
            </div>

            {/* Date and Location */}
            <div className="flex flex-col gap-1.5 w-full">
              <div className="flex flex-col gap-2 items-end">
                <div className="flex gap-2 items-center">
                  <div className="flex gap-2 items-center">
                    <CalendarDays className="w-6 h-6 text-black" />
                    <p className="font-normal text-sm text-black">
                      {formattedDate}
                    </p>
                  </div>
                  <div className="flex gap-2 items-center">
                    <MapPin className="w-6 h-6 text-black" />
                    <p className="font-normal text-sm text-black">
                      {location}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
