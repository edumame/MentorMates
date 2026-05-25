"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight, MapPin, ExternalLink } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { EventItem, EventRole } from "@/lib/types";
import { UI_TEXT } from "@/lib/config/constants";
import { Button } from "@/components/ui/button";
import { EventSearchInput } from "@/components/ui/event-search-input";
import { useAuth } from "@/features/user/authentication/auth/AuthContext";
import { CreateEventModal } from "@/components/events/create-event-modal";
import { parseEventDateLocal } from "@/lib/utils/date";
import { cn } from "@/lib/utils";

type EventWithRole = EventItem & { userRole?: EventRole | null };

type EventsPageClientProps = {
  eventsList: EventWithRole[];
  initialIsAuthenticated: boolean;
};

type TabKey = "discover" | "attended" | "hosting";

const TAB_LABELS: Record<TabKey, string> = {
  discover: "Discover",
  attended: "Attended",
  hosting: "Hosting",
};

const LOCATION_BUCKETS: { key: string; label: string; match: (loc: string) => boolean }[] = [
  { key: "sf", label: "SF & Bay Area", match: (l) => /san\s*francisco|bay\s*area|sf|palo\s*alto|stanford|berkeley|oakland/i.test(l) },
  { key: "nyc", label: "NYC", match: (l) => /new\s*york|nyc|manhattan|brooklyn/i.test(l) },
  { key: "la", label: "Los Angeles", match: (l) => /los\s*angeles|\bla\b|santa\s*monica/i.test(l) },
  { key: "hk", label: "Hong Kong", match: (l) => /hong\s*kong|hk/i.test(l) },
  { key: "sea", label: "Southeast Asia", match: (l) => /singapore|vietnam|jakarta|bangkok|kuala|manila|saigon|hanoi/i.test(l) },
  { key: "remote", label: "Remote", match: (l) => /remote|online|virtual|zoom/i.test(l) },
];

function bucketForLocation(loc: string | undefined): string | null {
  if (!loc) return null;
  for (const b of LOCATION_BUCKETS) if (b.match(loc)) return b.key;
  return "other";
}

type DateBucket = "today" | "tomorrow" | "thisWeek" | "nextWeek" | "later" | "past";

const DATE_BUCKET_LABEL: Record<DateBucket, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  thisWeek: "This week",
  nextWeek: "Next week",
  later: "Later",
  past: "Past events",
};

const DATE_ORDER: DateBucket[] = ["today", "tomorrow", "thisWeek", "nextWeek", "later", "past"];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function bucketForDate(eventDate: string): DateBucket {
  const parsed = parseEventDateLocal(eventDate);
  if (!parsed) return "later";
  const dayMs = 24 * 60 * 60 * 1000;
  const diff = Math.round((startOfDay(parsed) - startOfDay(new Date())) / dayMs);
  if (diff < 0) return "past";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff <= 7) return "thisWeek";
  if (diff <= 14) return "nextWeek";
  return "later";
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function EventsPageClient({
  eventsList,
  initialIsAuthenticated,
}: EventsPageClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("discover");
  const [selectedLocations, setSelectedLocations] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const {
    isAuthenticated: clientIsAuthenticated,
    isLoading: isAuthLoading,
  } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const searchParams = useSearchParams();
  const onboardingRole = searchParams.get("role");
  const isAuthenticated = isAuthLoading
    ? initialIsAuthenticated
    : clientIsAuthenticated;

  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    for (const e of eventsList) (e.event_type ?? []).forEach((t) => set.add(t));
    return Array.from(set).sort();
  }, [eventsList]);

  const tabFilteredEvents = useMemo(() => {
    if (!isAuthenticated || activeTab === "discover") return eventsList;
    if (activeTab === "hosting") {
      return eventsList.filter(
        (e) => e.userRole === EventRole.Organizer || e.userRole === EventRole.Admin
      );
    }
    return eventsList.filter(
      (e) =>
        e.userRole === EventRole.Participant ||
        e.userRole === EventRole.Judge ||
        e.userRole === EventRole.Mentor
    );
  }, [eventsList, activeTab, isAuthenticated]);

  const filteredEvents = useMemo(() => {
    return tabFilteredEvents.filter((event) => {
      if (searchTerm && !event.event_name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      if (selectedLocations.size > 0) {
        const bucket = bucketForLocation(event.location);
        if (!bucket || !selectedLocations.has(bucket)) return false;
      }
      if (selectedTypes.size > 0) {
        const types = event.event_type ?? [];
        if (!types.some((t) => selectedTypes.has(t))) return false;
      }
      if (selectedDate) {
        const parsed = parseEventDateLocal(event.event_date);
        if (!parsed || !sameDay(parsed, selectedDate)) return false;
      }
      return true;
    });
  }, [tabFilteredEvents, searchTerm, selectedLocations, selectedTypes, selectedDate]);

  const featuredEvents = useMemo(
    () => filteredEvents.filter((e) => e.featured).slice(0, 6),
    [filteredEvents]
  );

  const groupedByDate = useMemo(() => {
    const buckets: Record<DateBucket, EventWithRole[]> = {
      today: [],
      tomorrow: [],
      thisWeek: [],
      nextWeek: [],
      later: [],
      past: [],
    };
    for (const e of filteredEvents) {
      if (e.featured) continue;
      buckets[bucketForDate(e.event_date)].push(e);
    }
    for (const k of Object.keys(buckets) as DateBucket[]) {
      buckets[k].sort((a, b) => {
        const da = parseEventDateLocal(a.event_date)?.getTime() ?? 0;
        const db = parseEventDateLocal(b.event_date)?.getTime() ?? 0;
        return k === "past" ? db - da : da - db;
      });
    }
    return buckets;
  }, [filteredEvents]);

  const datesWithEvents = useMemo(() => {
    const set = new Set<string>();
    for (const e of filteredEvents) {
      const d = parseEventDateLocal(e.event_date);
      if (d) set.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
    return set;
  }, [filteredEvents]);

  const totalVisible = filteredEvents.length;

  const toggleLocation = (key: string) => {
    setSelectedLocations((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleType = (key: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const clearFilters = () => {
    setSelectedLocations(new Set());
    setSelectedTypes(new Set());
    setSelectedDate(null);
  };

  const hasActiveFilters =
    selectedLocations.size > 0 || selectedTypes.size > 0 || selectedDate !== null;

  const tabs: TabKey[] = isAuthenticated
    ? ["discover", "attended", "hosting"]
    : ["discover"];

  return (
    <div className="w-full">
      <div className="mt-6 mb-10 flex flex-col items-center gap-6">
        <h1 className="pt-10 text-center font-geist text-[48px] font-semibold leading-[1.05] tracking-[-0.06em] text-black sm:text-[64px]">
          Discover events
        </h1>
        <div className="flex w-full max-w-4xl flex-col gap-4">
          <div className="flex flex-wrap items-end justify-center gap-4">
            <EventSearchInput
              wrapperClassName="w-full max-w-[640px] flex-1"
              placeholder="Search by event or host title"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {isAuthenticated && (
              <Button
                className={cn(
                  "h-10 hidden sm:inline-flex",
                  onboardingRole === "organizer" && "animate-bounce"
                )}
                onClick={() => setShowCreateModal(true)}
              >
                Create an event
              </Button>
            )}
          </div>
          {isAuthenticated && (
            <Button
              className={cn(
                "h-10 sm:hidden w-full",
                onboardingRole === "organizer" && "animate-bounce"
              )}
              onClick={() => setShowCreateModal(true)}
            >
              Create an event
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
        <div className="min-w-0">
          <div
            role="tablist"
            aria-label="Events tabs"
            className="sticky top-0 z-10 flex items-center gap-6 border-b border-[rgba(0,0,0,0.08)] mb-6 bg-white/85 backdrop-blur-md -mx-2 px-2"
          >
            {tabs.map((key) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  role="tab"
                  type="button"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    "relative pb-3 pt-2 text-[15px] font-semibold tracking-[-0.05%] transition-colors",
                    isActive
                      ? "text-black"
                      : "text-[rgba(0,0,0,0.5)] hover:text-black"
                  )}
                >
                  {TAB_LABELS[key]}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-black" />
                  )}
                </button>
              );
            })}
          </div>

          {totalVisible === 0 ? (
            <EmptyState
              tab={activeTab}
              searchTerm={searchTerm}
              hasFilters={hasActiveFilters}
              isAuthenticated={isAuthenticated}
              onCreate={() => setShowCreateModal(true)}
              onClearFilters={clearFilters}
            />
          ) : (
            <div className="flex flex-col gap-10">
              {featuredEvents.length > 0 && (
                <section aria-labelledby="featured-heading">
                  <h2
                    id="featured-heading"
                    className="text-[21.6px] font-semibold tracking-[-0.288px] text-black mb-5"
                  >
                    Featured
                  </h2>
                  <div className="flex flex-col">
                    {featuredEvents.map((event) => (
                      <EventRow key={event.event_id} event={event} featured />
                    ))}
                  </div>
                </section>
              )}

              {DATE_ORDER.map((bucket) => {
                const items = groupedByDate[bucket];
                if (items.length === 0) return null;
                return (
                  <section key={bucket} aria-labelledby={`date-${bucket}-heading`}>
                    <h2
                      id={`date-${bucket}-heading`}
                      className="text-[21.6px] font-semibold tracking-[-0.288px] text-black mb-5"
                    >
                      {DATE_BUCKET_LABEL[bucket]}
                    </h2>
                    <div className="flex flex-col">
                      {items.map((event) => (
                        <EventRow key={event.event_id} event={event} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-6 flex flex-col gap-5">
            <MiniCalendar
              selected={selectedDate}
              onSelect={setSelectedDate}
              eventDates={datesWithEvents}
            />
            <FilterCard
              title="Locations"
              options={LOCATION_BUCKETS.map((b) => ({ key: b.key, label: b.label }))}
              selected={selectedLocations}
              onToggle={toggleLocation}
            />
            {availableTypes.length > 0 && (
              <FilterCard
                title="Event type"
                options={availableTypes.map((t) => ({
                  key: t,
                  label: t.charAt(0).toUpperCase() + t.slice(1),
                }))}
                selected={selectedTypes}
                onToggle={toggleType}
              />
            )}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-[13px] font-medium text-[rgba(0,0,0,0.6)] hover:text-black self-start hover:underline underline-offset-2"
              >
                Clear filters
              </button>
            )}
          </div>
        </aside>
      </div>

      {isAuthenticated && (
        <CreateEventModal
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
        />
      )}
    </div>
  );
}

function EventRow({ event, featured = false }: { event: EventWithRole; featured?: boolean }) {
  const parsed = parseEventDateLocal(event.event_date);
  const month = parsed
    ? parsed.toLocaleDateString("en-US", { month: "short" })
    : "—";
  const day = parsed ? parsed.getDate() : "—";
  const datetime = parsed
    ? parsed.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "Date TBD";

  const summary = (event.event_blurb || event.event_description || "").replace(/\s+/g, " ").trim();
  const external = event.external_url?.trim();
  const isExternal = !!external;
  const href = isExternal
    ? external
    : event.slug
      ? `/events/${event.slug}`
      : `/events/${event.event_id}`;

  return (
    <Link
      href={href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      className="group flex items-start gap-4 py-5 border-b border-[rgba(0,0,0,0.06)] hover:bg-[rgba(0,0,0,0.02)] transition-colors -mx-2 px-2 rounded-lg"
    >
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
          <span className="text-[11px] font-semibold uppercase tracking-wide">{month}</span>
          <span className="text-[22px] font-bold">{day}</span>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="font-semibold text-black text-[16px] tracking-[-0.5%] truncate group-hover:underline underline-offset-2">
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
    </Link>
  );
}

function MiniCalendar({
  selected,
  onSelect,
  eventDates,
}: {
  selected: Date | null;
  onSelect: (d: Date | null) => void;
  eventDates: Set<string>;
}) {
  const [cursor, setCursor] = useState(() => {
    const base = selected ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const today = new Date();

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells: { day: number; inMonth: boolean; date: Date }[] = [];
  for (let i = firstWeekday - 1; i >= 0; i--) {
    cells.push({
      day: prevMonthDays - i,
      inMonth: false,
      date: new Date(year, month - 1, prevMonthDays - i),
    });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, inMonth: true, date: new Date(year, month, d) });
  }
  while (cells.length < 42) {
    const next = cells.length - (firstWeekday + daysInMonth) + 1;
    cells.push({ day: next, inMonth: false, date: new Date(year, month + 1, next) });
  }

  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[14px] font-semibold text-black">{monthLabel}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="p-1 rounded-md hover:bg-gray-100 text-[rgba(0,0,0,0.6)]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="p-1 rounded-md hover:bg-gray-100 text-[rgba(0,0,0,0.6)]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div
            key={i}
            className="text-center text-[11px] font-medium text-[rgba(0,0,0,0.4)]"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          const key = `${c.date.getFullYear()}-${c.date.getMonth()}-${c.date.getDate()}`;
          const hasEvent = eventDates.has(key);
          const isToday = sameDay(c.date, today);
          const isSelected = selected ? sameDay(c.date, selected) : false;
          return (
            <button
              key={i}
              type="button"
              onClick={() => {
                if (isSelected) onSelect(null);
                else onSelect(c.date);
              }}
              disabled={!c.inMonth}
              className={cn(
                "relative aspect-square w-full flex items-center justify-center text-[12px] rounded-md transition-colors",
                c.inMonth
                  ? "text-black hover:bg-gray-100"
                  : "text-[rgba(0,0,0,0.25)] cursor-default",
                isSelected && "bg-black text-white hover:bg-black",
                !isSelected && isToday && "ring-1 ring-black/40"
              )}
            >
              {c.day}
              {c.inMonth && hasEvent && !isSelected && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-blue-500" />
              )}
            </button>
          );
        })}
      </div>
      {selected && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="mt-3 text-[12px] text-[rgba(0,0,0,0.6)] hover:text-black hover:underline underline-offset-2"
        >
          Clear date
        </button>
      )}
    </div>
  );
}

function FilterCard({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: { key: string; label: string }[];
  selected: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white p-4">
      <p className="font-semibold text-black text-[14px] mb-3">{title}</p>
      <div className="flex flex-col gap-2.5">
        {options.map((opt) => {
          const isOn = selected.has(opt.key);
          return (
            <label
              key={opt.key}
              className="flex items-center gap-3 cursor-pointer text-[13px] text-[rgba(0,0,0,0.7)] hover:text-black"
            >
              <input
                type="checkbox"
                checked={isOn}
                onChange={() => onToggle(opt.key)}
                className="h-4 w-4 rounded border-[rgba(0,0,0,0.2)] accent-black"
              />
              <span className={isOn ? "text-black font-medium" : ""}>{opt.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({
  tab,
  searchTerm,
  hasFilters,
  isAuthenticated,
  onCreate,
  onClearFilters,
}: {
  tab: TabKey;
  searchTerm: string;
  hasFilters: boolean;
  isAuthenticated: boolean;
  onCreate: () => void;
  onClearFilters: () => void;
}) {
  const heading =
    tab === "hosting"
      ? "You haven't created an event yet"
      : tab === "attended"
        ? "No events you've joined yet"
        : "No events found";
  const body = searchTerm
    ? `No events match your search "${searchTerm}". Try adjusting your search terms.`
    : hasFilters
      ? "No events match your filters."
      : tab === "hosting"
        ? "Host your own — submissions go through a quick admin review before they appear publicly."
        : tab === "attended"
          ? "Once you join or get invited to an event, it'll show up here."
          : UI_TEXT.NO_EVENTS_FOUND;

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <svg
        className="h-16 w-16 text-gray-400 mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <h3 className="text-lg font-medium text-gray-900 mb-2">{heading}</h3>
      <p className="text-gray-500 max-w-sm">{body}</p>
      <div className="mt-4 flex gap-2">
        {hasFilters && (
          <Button variant="outline" onClick={onClearFilters}>
            Clear filters
          </Button>
        )}
        {tab === "hosting" && isAuthenticated && (
          <Button onClick={onCreate}>Create an event</Button>
        )}
      </div>
    </div>
  );
}
