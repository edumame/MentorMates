"use client";

import Link from "next/link";
import Image from "next/image";
import { MapPin, ExternalLink } from "lucide-react";
import { EventItem, EventRole } from "@/lib/types";
import { parseEventDateLocal } from "@/lib/utils/date";
import { cn } from "@/lib/utils";

export type EventRowVariant = "A" | "B" | "C";

export const EVENT_ROW_VARIANTS: { key: EventRowVariant; label: string; description: string }[] = [
  { key: "A", label: "A — Compact dark tile", description: "62px dark date tile, no image. Fastest scan, densest layout." },
  { key: "B", label: "B — Image + MM date overlay", description: "Cover image (160x120) on the left with the MentorMates white date badge overlaid in the top-right of the image. Most visual." },
  { key: "C", label: "C — Big MM date badge", description: "Standalone white MentorMates date badge as the visual anchor. No image. Strongest MM identity." },
];

export type EventWithRole = EventItem & { userRole?: EventRole | null };

function useEventDateParts(eventDate: string) {
  const parsed = parseEventDateLocal(eventDate);
  if (!parsed) {
    return {
      dayOfWeek: "—",
      day: "—",
      monthYear: "—",
      monthShort: "—",
      datetime: "Date TBD",
    };
  }
  return {
    dayOfWeek: parsed.toLocaleDateString("en-US", { weekday: "short" }),
    day: parsed.toLocaleDateString("en-US", { day: "2-digit" }),
    monthYear: parsed.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
    monthShort: parsed.toLocaleDateString("en-US", { month: "short" }),
    datetime: parsed.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
  };
}

function buildHref(event: EventWithRole) {
  const external = event.external_url?.trim();
  if (external) return { href: external, isExternal: true };
  const path = event.slug ? `/events/${event.slug}` : `/events/${event.event_id}`;
  return { href: path, isExternal: false };
}

function ContentBlock({ event, datetime }: { event: EventWithRole; datetime: string }) {
  const summary = (event.event_blurb || event.event_description || "").replace(/\s+/g, " ").trim();
  const { isExternal } = buildHref(event);
  return (
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
            className="px-2 py-0.5 border border-[rgba(0,0,0,0.12)] rounded-full text-[12px] font-medium text-[rgba(0,0,0,0.7)]"
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </span>
        ))}
      </div>
    </div>
  );
}

function MmDateBadge({
  dayOfWeek,
  day,
  monthYear,
  size = "md",
  floating = false,
}: {
  dayOfWeek: string;
  day: string;
  monthYear: string;
  size?: "sm" | "md" | "lg";
  floating?: boolean;
}) {
  const sizes = {
    sm: { box: "w-[64px] py-2 px-1", dow: "text-[11px]", day: "text-[22px]", my: "text-[11px]" },
    md: { box: "w-[80px] py-2.5 px-1", dow: "text-[12px]", day: "text-[30px]", my: "text-[12px]" },
    lg: { box: "w-[100px] py-3 px-1.5", dow: "text-[14px]", day: "text-[36px]", my: "text-[14px]" },
  }[size];
  return (
    <div
      className={cn(
        "shrink-0 bg-white border border-[#aaaaaa] rounded-[6px] text-center text-black flex flex-col items-center justify-center",
        sizes.box,
        floating && "shadow-md"
      )}
    >
      <p className={cn(sizes.dow, "font-normal leading-tight")}>{dayOfWeek}</p>
      <p
        className={cn(sizes.day, "font-semibold leading-[1.1] tracking-[-0.04em]")}
        style={{ fontFamily: "Geist, sans-serif" }}
      >
        {day}
      </p>
      <p className={cn(sizes.my, "font-normal leading-tight")}>{monthYear}</p>
    </div>
  );
}

function RowLink({
  event,
  children,
}: {
  event: EventWithRole;
  children: React.ReactNode;
}) {
  const { href, isExternal } = buildHref(event);
  return (
    <Link
      href={href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      className="group flex items-start gap-4 py-5 border-b border-[rgba(0,0,0,0.06)] hover:bg-[rgba(0,0,0,0.02)] transition-colors -mx-2 px-2 rounded-lg"
    >
      {children}
    </Link>
  );
}

function VariantA({ event, featured }: { event: EventWithRole; featured?: boolean }) {
  const { day, monthShort, datetime } = useEventDateParts(event.event_date);
  return (
    <RowLink event={event}>
      <div
        className={cn(
          "relative shrink-0 h-[62px] w-[62px] rounded-lg overflow-hidden text-white flex flex-col items-center justify-center",
          featured ? "bg-gradient-to-br from-orange-500 via-red-500 to-purple-600" : "bg-zinc-900"
        )}
      >
        {event.cover_image_url && (
          <Image
            src={event.cover_image_url}
            alt=""
            fill
            className="object-cover opacity-60"
            unoptimized={event.cover_image_url.startsWith("http")}
          />
        )}
        <div className="relative z-10 flex flex-col items-center -space-y-0.5 leading-none">
          <span className="text-[11px] font-semibold uppercase tracking-wide">{monthShort}</span>
          <span className="text-[22px] font-bold">{day}</span>
        </div>
      </div>
      <ContentBlock event={event} datetime={datetime} />
    </RowLink>
  );
}

function VariantB({ event }: { event: EventWithRole; featured?: boolean }) {
  const { dayOfWeek, day, monthYear, datetime } = useEventDateParts(event.event_date);
  const { href, isExternal } = buildHref(event);
  return (
    <Link
      href={href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      className="group block py-3 border-b border-[rgba(0,0,0,0.06)] -mx-2 px-2 rounded-lg hover:bg-[rgba(0,0,0,0.02)] transition-colors"
    >
      <div className="relative w-full aspect-[16/7] rounded-xl overflow-hidden">
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
        <div className="absolute top-4 right-4">
          <MmDateBadge
            dayOfWeek={dayOfWeek}
            day={day}
            monthYear={monthYear}
            size="md"
            floating
          />
        </div>
      </div>
      <div className="pt-3 px-1">
        <ContentBlock event={event} datetime={datetime} />
      </div>
    </Link>
  );
}

function VariantC({ event }: { event: EventWithRole; featured?: boolean }) {
  const { dayOfWeek, day, monthYear, datetime } = useEventDateParts(event.event_date);
  return (
    <RowLink event={event}>
      <MmDateBadge dayOfWeek={dayOfWeek} day={day} monthYear={monthYear} size="md" />
      <ContentBlock event={event} datetime={datetime} />
    </RowLink>
  );
}

export function EventRow({
  event,
  variant = "A",
  featured = false,
}: {
  event: EventWithRole;
  variant?: EventRowVariant;
  featured?: boolean;
}) {
  switch (variant) {
    case "B":
      return <VariantB event={event} featured={featured} />;
    case "C":
      return <VariantC event={event} featured={featured} />;
    case "A":
    default:
      return <VariantA event={event} featured={featured} />;
  }
}
