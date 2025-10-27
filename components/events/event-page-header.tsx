"use client";

import { CalendarDays, MapPin, ArrowUpRight, Plus } from "lucide-react";
import { EventRole } from "@/lib/types";
import { JoinEventButton } from "./join-event-button";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { parseEventDateLocal } from "@/lib/utils/date";

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
  const { dayOfWeek, day, monthYear } = (() => {
    const parsed = parseEventDateLocal(eventDate);
    if (!parsed) return { dayOfWeek: "TBD", day: "--", monthYear: "" };
    return {
      dayOfWeek: parsed.toLocaleDateString("en-US", { weekday: "short" }),
      day: parsed.toLocaleDateString("en-US", { day: "2-digit" }),
      monthYear: parsed.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      }),
    };
  })();
  return (
    <div
      className="bg-white flex flex-col w-full overflow-x-hidden"
      style={{ maxWidth: "100vw" }}
    >
      {/* Cover Image */}
      <div
        className="h-[240px] w-full relative overflow-hidden"
        style={{ maxWidth: "100%" }}
      >
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
        <div className="absolute left-4 md:left-6 top-4 md:top-6 flex flex-wrap gap-1 z-10">
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
        className="box-border flex flex-col gap-[24px] items-start max-w-[1280px] pb-[24px] pt-[24px] w-full mx-auto overflow-x-hidden"
        style={{
          background:
            "linear-gradient(196.644deg, rgba(219, 234, 254, 0.25) 13.188%, rgba(255, 255, 255, 0) 65.83%), linear-gradient(90deg, rgb(251, 252, 254) 0%, rgb(251, 252, 254) 100%)",
        }}
      >
        <div className="box-border flex flex-col gap-[16px] md:gap-[24px] items-start justify-end px-4 md:px-6 py-0 w-full">
          <div className="flex flex-col gap-[16px] items-start w-full min-w-0">
            <div className="flex flex-col md:flex-row items-start md:items-start justify-between w-full gap-6">
              {/* Left: Event Info */}
              <div className="flex flex-col gap-[8px] items-start w-full md:w-[617px]">
                <div className="flex flex-col items-start text-black w-full min-w-0">
                  <h1 className="font-semibold text-[22px] md:text-[28px] leading-[1.4] tracking-[-0.04em] text-black w-full">
                    {eventName}
                  </h1>
                  <p className="font-normal text-sm md:text-base leading-[1.5] text-black w-full break-words">
                    {eventBlurb}
                  </p>
                </div>
              </div>

              {/* Right: Join Button and Meta */}
              <div className="flex flex-col gap-[12px] items-stretch md:items-end justify-center w-full min-w-0">
                <div className="flex flex-col gap-[12px] md:gap-[16px] items-stretch md:items-center justify-center w-full min-w-0">
                  <div className="flex gap-[16px] items-start w-full min-w-0">
                    {(() => {
                      const roleForView = activeRole ?? userRole ?? null;
                      const isPresenterView =
                        roleForView === EventRole.Participant;

                      if (isPresenterView) {
                        return (
                          <Button
                            asChild
                            variant="default"
                            size="lg"
                            className="rounded-full px-6 py-5 gap-2"
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
                        <div className="bg-green-500 box-border flex gap-[6px] items-center justify-center px-[20px] py-[8px] rounded-[12px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] w-full">
                          <p className="font-medium text-base leading-[1.5] text-white">
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
                <div className="flex gap-[8px] items-start md:items-center w-full flex-col md:flex-row">
                  <div className="flex gap-[8px] items-center w-full min-w-0">
                    <CalendarDays className="w-5 h-5 md:w-6 md:h-6 text-black flex-shrink-0" />
                    <p className="font-normal text-sm leading-[1.5] text-black break-words">
                      {dayOfWeek}, {day} {monthYear}
                    </p>
                  </div>
                  <div className="flex gap-[8px] items-center w-full min-w-0">
                    <MapPin className="w-5 h-5 md:w-6 md:h-6 text-black flex-shrink-0" />
                    <p className="font-normal text-sm leading-[1.5] text-black break-words">
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
