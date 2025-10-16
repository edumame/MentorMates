"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import { EventItem } from "@/lib/types";

interface EventCardProps {
  event: EventItem & { event_blurb?: string };
}

export function EventCard({ event }: EventCardProps) {
  // Parse date for display with safe fallbacks
  const { dayOfWeek, day, monthYear } = (() => {
    try {
      const parsed = new Date(event.event_date);
      if (Number.isNaN(parsed.getTime())) {
        return { dayOfWeek: "TBD", day: "--", monthYear: "" };
      }
      return {
        dayOfWeek: parsed.toLocaleDateString("en-US", { weekday: "short" }),
        day: parsed.toLocaleDateString("en-US", { day: "2-digit" }),
        monthYear: parsed.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      };
    } catch {
      return { dayOfWeek: "TBD", day: "--", monthYear: "" };
    }
  })();

  // Determine if event is paid or free
  const isPaid = event.paid || event.stripe_price_id;

  // Get event blurb or fallback to empty string
  const eventBlurb = event.event_blurb || "";

  return (
    <Link
      href={`/events/${event.slug || event.event_id}/overview`}
      className="block h-full"
      prefetch={false}
    >
      <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl overflow-hidden hover:shadow-lg transition-shadow duration-200 flex flex-col h-full">
        {/* Image Section */}
        <div className="relative w-full aspect-[405.333/270]">
          {event.cover_image_url ? (
            <img
              src={event.cover_image_url}
              alt={event.event_name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-blue-100 to-blue-50" />
          )}

          {/* Date Badge */}
          <div className="absolute top-4 right-4 bg-white border border-[#aaaaaa] rounded-xl w-28 px-1 py-3 text-center shadow-sm">
            <p className="font-normal text-xs text-black">{dayOfWeek}</p>
            <p className="font-semibold text-2xl sm:text-4xl text-black leading-tight tracking-tight">
              {day}
            </p>
            <p className="font-normal text-xs text-black">{monthYear}</p>
          </div>
        </div>

        {/* Content Section */}
        <div className="px-6 py-4 space-y-3 sm:space-y-4 flex flex-col flex-1">
          {/* Event Details Tags */}
          <div className="flex flex-wrap gap-1">
            <Badge
              variant="outline"
              className="bg-transparent border-[rgba(0,0,0,0.15)] rounded-full px-2.5 py-1 text-xs font-semibold text-black"
            >
              Hackathon
            </Badge>
            <Badge
              variant="outline"
              className="bg-transparent border-[rgba(0,0,0,0.15)] rounded-full px-2.5 py-1 text-xs font-semibold text-black"
            >
              {isPaid ? "Paid" : "Free"}
            </Badge>
          </div>

          {/* Title and Location */}
          <div className="space-y-2">
            <h3 className="font-semibold text-[20px] sm:text-[28px] leading-[1.4] tracking-[-0.06em] text-black line-clamp-2">
              {event.event_name}
            </h3>
            <div className="flex items-center gap-1">
              <MapPin className="w-6 h-6 text-black flex-shrink-0" strokeWidth={1.5} />
              <p className="font-normal text-xs text-black truncate">{event.location}</p>
            </div>
          </div>

          {/* Description */}
          {eventBlurb && (
            <p className="font-normal text-xs leading-[1.5] text-black line-clamp-3">
              {eventBlurb}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
