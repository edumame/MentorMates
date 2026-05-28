"use client";

import Link from "next/link";
import Image from "next/image";
import { MapPin, ExternalLink } from "lucide-react";
import { EventItem, EventRole } from "@/lib/types";
import { parseEventDateLocal } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import { getEventNavigationTarget } from "@/lib/events/navigation";

export type EventWithRole = EventItem & {
  userRole?: EventRole | null;
  canManageEvent?: boolean | null;
};

function useEventDateParts(eventDate: string) {
  const parsed = parseEventDateLocal(eventDate);
  if (!parsed) {
    return {
      dayOfWeek: "—",
      day: "—",
      monthYear: "—",
      datetime: "Date TBD",
    };
  }
  return {
    dayOfWeek: parsed.toLocaleDateString("en-US", { weekday: "short" }),
    day: parsed.toLocaleDateString("en-US", { day: "2-digit" }),
    monthYear: parsed.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
    datetime: parsed.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
  };
}

function MmDateBadge({
  dayOfWeek,
  day,
  monthYear,
}: {
  dayOfWeek: string;
  day: string;
  monthYear: string;
}) {
  return (
    <div className="shrink-0 w-[64px] py-2 px-1 bg-white border border-[#aaaaaa] rounded-[6px] text-center text-black flex flex-col items-center justify-center shadow-md">
      <p className="text-[11px] font-normal leading-tight">{dayOfWeek}</p>
      <p
        className="text-[22px] font-semibold leading-[1.1] tracking-[-0.04em]"
        style={{ fontFamily: "Geist, sans-serif" }}
      >
        {day}
      </p>
      <p className="text-[11px] font-normal leading-tight">{monthYear}</p>
    </div>
  );
}

export function EventRow({ event }: { event: EventWithRole }) {
  const { dayOfWeek, day, monthYear, datetime } = useEventDateParts(event.event_date);
  const { href, isExternal } = getEventNavigationTarget(event);
  const summary = (event.event_blurb || event.event_description || "").replace(/\s+/g, " ").trim();

  return (
    <Link
      href={href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      className="group flex items-start gap-4 py-5 border-b border-[rgba(0,0,0,0.06)] hover:bg-[rgba(0,0,0,0.02)] transition-colors -mx-2 px-2 rounded-lg"
    >
      <div className="relative shrink-0 h-[120px] w-[160px] rounded-lg overflow-hidden">
        {event.cover_image_url ? (
          <Image
            src={event.cover_image_url}
            alt=""
            fill
            className="object-cover"
            unoptimized={event.cover_image_url.startsWith("http")}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-orange-400 via-red-500 to-purple-600" />
        )}
        <div className="absolute top-2 right-2">
          <MmDateBadge dayOfWeek={dayOfWeek} day={day} monthYear={monthYear} />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="font-semibold text-black text-[16px] tracking-[-0.5%] line-clamp-1 group-hover:underline underline-offset-2">
            {event.event_name}
          </h3>
          {isExternal && (
            <ExternalLink className="h-3.5 w-3.5 text-[rgba(0,0,0,0.4)] shrink-0" />
          )}
        </div>
        <p className="mt-[2px] text-[14px] text-[rgba(0,0,0,0.55)]">{datetime}</p>
        {event.location && (
          <div className="mt-1.5 flex items-center gap-1 text-[14px] text-[rgba(0,0,0,0.55)]">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{event.location}</span>
          </div>
        )}
        {summary && (
          <p className="mt-1.5 text-[14px] leading-[1.5] text-[rgba(0,0,0,0.7)] line-clamp-2">
            {summary}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(event.event_type ?? []).slice(0, 3).map((t) => (
            <span
              key={t}
              className={cn(
                "px-2 py-0.5 border border-[rgba(0,0,0,0.12)] rounded-full text-[12px] font-medium text-[rgba(0,0,0,0.7)]"
              )}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
