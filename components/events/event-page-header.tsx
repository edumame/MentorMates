"use client";

import { CalendarDays, MapPin, ArrowUpRight, Plus } from "lucide-react";
import { EventRole } from "@/lib/types";
import { JoinEventButton } from "./join-event-button";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface EventPageHeaderProps {
  eventName: string;
  eventBlurb: string;
  eventDate: string;
  location: string;
  coverImageUrl?: string;
  eventId: string;
  hasJoined: boolean;
  userRole?: EventRole | null;
  /**
   * The role currently being viewed (from RoleSwitcher). If provided, this
   * determines the CTA shown (e.g., presenters see "Create Project").
   * Falls back to userRole when not provided.
   */
  activeRole?: EventRole | null;
  onManageEventClick?: () => void;
  paid: boolean;
  eventType: string;
}

export function EventPageHeader({
  eventName,
  eventBlurb,
  eventDate,
  location,
  coverImageUrl,
  eventId,
  hasJoined,
  userRole,
  activeRole,
  onManageEventClick,
  paid,
  eventType,
}: EventPageHeaderProps) {
  // Format date
  const formattedDate = new Date(eventDate).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="bg-white flex flex-col items-center w-full">
      {/* Cover Image */}
      <div className="h-[200px] sm:h-[240px] w-full relative overflow-hidden">
        {coverImageUrl ? (
          <>
            <img
              src={coverImageUrl}
              alt={eventName}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
              }}
            />
            <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-[#1e3a8a] to-[#3c73bd] -z-10" />
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-[#1e3a8a] to-[#3c73bd]" />
        )}

        {/* Event Tags */}
        <div className="absolute left-6 top-6 flex flex-wrap gap-1 z-10">
          <div className="bg-white border border-[rgba(0,0,0,0.15)] px-2.5 py-1 rounded-full">
            <p className="font-semibold text-sm leading-[1.5] text-black whitespace-nowrap">
              {eventType
                ? eventType.charAt(0).toUpperCase() + eventType.slice(1)
                : "Hackathon"}
            </p>
          </div>
          <div className="bg-white border border-[rgba(0,0,0,0.15)] px-2.5 py-1 rounded-full">
            {paid ? (
              <p className="font-semibold text-sm leading-[1.5] text-black whitespace-nowrap">
                Paid
              </p>
            ) : (
              <p className="font-semibold text-sm leading-[1.5] text-black whitespace-nowrap">
                Free
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Content Section - responsive container */}
      <div
        className="box-border flex flex-col gap-[24px] items-start pb-[24px] pt-[24px] px-2 md:px-4 w-full"
        style={{
          background:
            "linear-gradient(180deg, rgba(219, 234, 254, 0.3) 0%, rgba(251, 252, 254, 0.8) 100%)",
        }}
      >
        <div className="box-border flex flex-col gap-[24px] items-start justify-end px-0 sm:px-[12px] py-0 w-full">
          <div className="flex flex-col gap-[16px] items-start w-full">
            <div className="flex flex-col md:flex-row items-start md:items-start justify-between w-full gap-6">
              {/* Left: Event Info */}
              <div className="flex flex-col gap-[8px] items-start w-full md:max-w-[617px]">
                <div className="flex flex-col items-start text-black w-full">
                  <h1
                    className="font-semibold text-[24px] sm:text-[28px] leading-[1.4] tracking-[-1.68px] w-full"
                    style={{
                      background:
                        "linear-gradient(to bottom, #1e3a8a, #3c73bd)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                      color: "transparent",
                    }}
                  >
                    {eventName}
                  </h1>
                  <p className="font-normal text-sm sm:text-base leading-[1.6] text-black line-clamp-4 sm:line-clamp-3 w-full">
                    {eventBlurb}
                  </p>
                </div>
              </div>

              {/* Right: Join Button and Meta */}
              <div className="flex flex-col gap-[12px] items-stretch md:items-end justify-center w-full md:w-[411px]">
                <div className="flex flex-col gap-[16px] items-stretch md:items-center justify-center">
                  <div className="flex gap-[12px] items-start w-full">
                    {(() => {
                      const roleForView = activeRole ?? userRole ?? null;
                      const isPresenterView =
                        roleForView === EventRole.Participant;

                      if (isPresenterView) {
                        return (
                          <Button
                            asChild
                            variant="default"
                            size="default"
                            className="rounded-full px-5 py-4 gap-2"
                          >
                            <Link href={`/projects/submit?eventId=${eventId}`}>
                              <Plus className="h-6 w-6" /> Create Project
                            </Link>
                          </Button>
                        );
                      }

                      if (!hasJoined) {
                        return (
                          <JoinEventButton
                            eventId={eventId}
                            eventName={eventName}
                          />
                        );
                      }

                      return (
                        <div className="basis-0 bg-green-500 box-border flex gap-[6px] grow items-center justify-center min-h-px min-w-px px-[16px] py-[8px] rounded-[12px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] shrink-0">
                          <p className="font-medium text-sm sm:text-base leading-[1.5] text-white whitespace-pre md:text-nowrap">
                            Joined
                          </p>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Manage Event Button */}
                  {(userRole === "organizer" || userRole === "admin") && (
                    <button
                      onClick={onManageEventClick}
                      className="bg-[#f2f2f2] box-border flex gap-[6px] items-center justify-center px-[16px] py-[8px] rounded-[12px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] w-full md:w-[341px]"
                    >
                      <ArrowUpRight className="w-6 h-6 text-black" />
                      <p className="font-medium text-sm sm:text-base leading-[1.5] text-black whitespace-pre md:text-nowrap">
                        Manage event
                      </p>
                    </button>
                  )}
                </div>

                {/* Date and Location */}
                <div className="flex gap-[8px] items-start md:items-end w-full md:w-[341px] flex-col md:flex-row md:justify-end">
                  <div className="flex gap-[8px] items-center flex-1 w-full md:flex-none md:w-auto">
                    <CalendarDays className="w-6 h-6 text-black" />
                    <p className="font-normal text-sm leading-[1.5] text-black md:text-nowrap">
                      {formattedDate}
                    </p>
                  </div>
                  <div className="flex gap-[8px] items-center flex-1 w-full md:flex-none md:w-auto">
                    <MapPin className="w-6 h-6 text-black" />
                    <p className="font-normal text-sm leading-[1.5] text-black md:text-nowrap">
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
