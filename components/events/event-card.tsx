"use client";

import Link from "next/link";
import Image from "next/image";
import { MapPin } from "lucide-react";
import { EventItem } from "@/lib/types";
import { parseEventDateLocal } from "@/lib/utils/date";

interface EventCardProps {
  event: EventItem;
}

export function EventCard({ event }: EventCardProps) {
  // Parse date for display with safe fallbacks
  const { dayOfWeek, day, monthYear } = (() => {
    const parsed = parseEventDateLocal(event.event_date);
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

  // Determine if event is paid or free
  const isPaid = event.paid || event.stripe_price_id;

  const eventTypes = event.event_type?.length ? event.event_type : ["Hackathon"];

  // Choose the best available summary for the event
  const normalizeSummary = (text?: string | null) =>
    text?.replace(/\s+/g, " ").trim();
  const eventSummary =
    normalizeSummary(event.event_blurb) ||
    normalizeSummary(event.event_description) ||
    "";

  // External-link events: the card opens an outside site in a new tab
  // instead of routing to the MentorMates event page.
  const externalUrl = event.external_url?.trim();
  const cardInner = (
    <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] overflow-hidden hover:shadow-lg transition-shadow duration-200 flex flex-col h-full">
        {/* Image Section */}
        <div className="relative w-full aspect-[335/223] overflow-hidden">
          {event.cover_image_url ? (
            <Image
              src={event.cover_image_url}
              alt={event.event_name}
              fill
              className="object-cover"
              unoptimized={event.cover_image_url.startsWith("http")}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-orange-400 via-red-500 to-purple-600" />
          )}

          {/* Date Badge */}
          <div className="absolute top-4 right-4 bg-white border border-[#aaaaaa] rounded-[6px] w-[112px] py-3 px-1 text-center">
            <p className="text-[14px] font-normal text-black">{dayOfWeek}</p>
            <p
              className="text-[36px] font-semibold leading-[1.3] tracking-[-2.16px] text-black"
              style={{ fontFamily: "Geist, sans-serif" }}
            >
              {day}
            </p>
            <p className="text-[14px] font-normal text-black">{monthYear}</p>
          </div>
        </div>

        {/* Content Section */}
        <div className="px-6 py-4 flex flex-col flex-1">
          {/* Event Details Tags */}
          <div className="flex flex-wrap gap-1 mb-3">
            {eventTypes.map((type) => (
              <span key={type} className="px-[10px] py-1 border border-[rgba(0,0,0,0.15)] rounded-full text-[14px] font-semibold text-black">
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </span>
            ))}
            <span className="px-[10px] py-1 border border-[rgba(0,0,0,0.15)] rounded-full text-[14px] font-semibold text-black">
              {isPaid ? "Paid" : "Free"}
            </span>
          </div>

          {/* Title */}
          <h3
            className="text-[22px] font-semibold leading-[1.4] tracking-[-1.32px] text-black mb-1"
            style={{ fontFamily: "Geist, sans-serif" }}
          >
            {event.event_name}
          </h3>

          {/* Location */}
          <div className="flex items-center gap-1 mb-2">
            <MapPin className="w-6 h-6 text-black flex-shrink-0" />
            <span className="text-[14px] font-normal text-black">
              {event.location || "Online"}
            </span>
          </div>

          {/* Description */}
          <p className="text-[16px] font-normal text-black leading-[1.5] line-clamp-3">
            {eventSummary ||
              "Event details will be added soon. Check back for the latest info."}
          </p>
        </div>
      </div>
  );

  if (externalUrl) {
    return (
      <a
        href={externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block h-full"
      >
        {cardInner}
      </a>
    );
  }

  return (
    <Link
      href={`/events/${event.slug || event.event_id}/overview`}
      className="block h-full"
      prefetch={false}
    >
      {cardInner}
    </Link>
  );
}
