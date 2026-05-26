"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { EventRole } from "@/lib/types";
import { UI_TEXT } from "@/lib/config/constants";
import { Button } from "@/components/ui/button";
import { EventSearchInput } from "@/components/ui/event-search-input";
import { useAuth } from "@/features/user/authentication/auth/AuthContext";
import { CreateEventModal } from "@/components/events/create-event-modal";
import { EventsList } from "@/components/events/events-list";
import { parseEventDateLocal } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import { EventRow, type EventWithRole } from "@/components/events/event-row";

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

const HIDDEN_EVENT_TYPES = new Set<string>(["dd-build-night", "dd-hackathon"]);

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
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null,
  });
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
    for (const e of eventsList)
      (e.event_type ?? []).forEach((t) => {
        const lower = t.toLowerCase();
        if (HIDDEN_EVENT_TYPES.has(lower)) return;
        set.add(t);
      });
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
      if (dateRange.start) {
        const parsed = parseEventDateLocal(event.event_date);
        if (!parsed) return false;
        const eventStart = startOfDay(parsed);
        const rangeStart = startOfDay(dateRange.start);
        const rangeEnd = startOfDay(dateRange.end ?? dateRange.start);
        if (eventStart < rangeStart || eventStart > rangeEnd) return false;
      }
      return true;
    });
  }, [tabFilteredEvents, searchTerm, selectedLocations, selectedTypes, dateRange]);

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
    setDateRange({ start: null, end: null });
  };

  const handleDayClick = (date: Date) => {
    setDateRange((prev) => {
      if (!prev.start) return { start: date, end: null };
      if (prev.start && !prev.end) {
        if (sameDay(date, prev.start)) return { start: null, end: null };
        if (date < prev.start) return { start: date, end: prev.start };
        return { start: prev.start, end: date };
      }
      return { start: date, end: null };
    });
  };

  const hasActiveFilters =
    selectedLocations.size > 0 || selectedTypes.size > 0 || dateRange.start !== null;

  const tabs: TabKey[] = isAuthenticated
    ? ["discover", "attended", "hosting"]
    : ["discover"];

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
        <div className="min-w-0">
          <div
            className="sticky top-[72px] z-30 bg-white/90 backdrop-blur-md -mx-2 px-2 pt-3 pb-0 mb-6 border-b border-[rgba(0,0,0,0.08)]"
          >
            <div className="flex items-center justify-between gap-4 pb-3">
              <h1 className="font-geist text-[24px] font-semibold tracking-[-0.5%] text-black">
                Events
              </h1>
              {isAuthenticated && (
                <Button
                  className={cn(
                    "h-9",
                    onboardingRole === "organizer" && "animate-bounce"
                  )}
                  onClick={() => setShowCreateModal(true)}
                >
                  Create an event
                </Button>
              )}
            </div>
            <div className="pb-3">
              <EventSearchInput
                wrapperClassName="w-full"
                placeholder="Search by event or host title"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div
              role="tablist"
              aria-label="Events tabs"
              className="flex items-center gap-6"
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
                  <div className="lg:hidden">
                    <EventsList events={featuredEvents} />
                  </div>
                  <div className="hidden lg:flex lg:flex-col">
                    {featuredEvents.map((event) => (
                      <EventRow key={event.event_id} event={event} />
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
                    <div className="lg:hidden">
                      <EventsList events={items} />
                    </div>
                    <div className="hidden lg:flex lg:flex-col">
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
          <div className="sticky top-[88px] flex flex-col gap-5">
            <MiniCalendar
              dateRange={dateRange}
              onDayClick={handleDayClick}
              onClear={() => setDateRange({ start: null, end: null })}
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

function MiniCalendar({
  dateRange,
  onDayClick,
  onClear,
  eventDates,
}: {
  dateRange: { start: Date | null; end: Date | null };
  onDayClick: (d: Date) => void;
  onClear: () => void;
  eventDates: Set<string>;
}) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const today = new Date();
  const hasSelection = dateRange.start !== null;
  const rangeStart = dateRange.start;
  const rangeEnd = dateRange.end ?? dateRange.start;

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
    <div className="rounded-[12px] border border-[rgba(0,0,0,0.15)] bg-white p-3 sm:p-4 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[14px] sm:text-[16px] font-semibold text-black">
          {monthLabel}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-black transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-black transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d, i) => (
          <div
            key={i}
            className="text-center text-[12px] font-normal text-gray-600 py-1"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((c, i) => {
          const key = `${c.date.getFullYear()}-${c.date.getMonth()}-${c.date.getDate()}`;
          const hasEvent = eventDates.has(key);
          const isToday = sameDay(c.date, today);
          const cellTime = startOfDay(c.date);
          const startTime = rangeStart ? startOfDay(rangeStart) : null;
          const endTime = rangeEnd ? startOfDay(rangeEnd) : null;
          const inRange =
            startTime !== null &&
            endTime !== null &&
            cellTime >= startTime &&
            cellTime <= endTime;
          const isStart = startTime !== null && cellTime === startTime;
          const isEnd = endTime !== null && cellTime === endTime;
          const isSingle = isStart && isEnd;
          const isMiddle = inRange && !isStart && !isEnd;
          const dayOfWeek = i % 7;
          const isWeekStart = dayOfWeek === 0;
          const isWeekEnd = dayOfWeek === 6;
          return (
            <div
              key={i}
              className={cn(
                "relative",
                inRange && !isSingle && "bg-blue-50",
                inRange && isStart && !isSingle && "rounded-l-lg",
                inRange && isEnd && !isSingle && "rounded-r-lg",
                isMiddle && isWeekStart && "rounded-l-lg",
                isMiddle && isWeekEnd && "rounded-r-lg"
              )}
            >
              <button
                type="button"
                onClick={() => onDayClick(c.date)}
                disabled={!c.inMonth}
                className={cn(
                  "relative aspect-square w-full flex items-center justify-center text-[14px] font-normal rounded-lg transition-colors",
                  c.inMonth
                    ? "text-black hover:bg-gray-100"
                    : "text-gray-400 cursor-default",
                  (isStart || isEnd) && "bg-blue-500 text-white hover:bg-blue-600",
                  !isStart && !isEnd && isToday && "border-2 border-blue-500"
                )}
              >
                {c.day}
                {c.inMonth && hasEvent && !isStart && !isEnd && (
                  <span
                    className={cn(
                      "absolute bottom-1 h-1 w-1 rounded-full",
                      isMiddle ? "bg-blue-500/60" : "bg-blue-500"
                    )}
                  />
                )}
              </button>
            </div>
          );
        })}
      </div>
      {hasSelection && rangeStart && (
        <div className="mt-3 flex items-center justify-between text-[12px]">
          <span className="text-[rgba(0,0,0,0.7)] font-medium">
            {formatRange(rangeStart, dateRange.end)}
          </span>
          <button
            type="button"
            onClick={onClear}
            className="text-[rgba(0,0,0,0.5)] hover:text-black hover:underline underline-offset-2"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

function formatRange(start: Date, end: Date | null): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (!end || sameDay(start, end)) return fmt(start);
  return `${fmt(start)} – ${fmt(end)}`;
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
    <div className="rounded-[12px] border border-[rgba(0,0,0,0.15)] bg-white p-4 shadow-sm">
      <p className="font-semibold text-black text-[14px] mb-3">{title}</p>
      <div className="flex flex-col gap-2.5">
        {options.map((opt) => {
          const isOn = selected.has(opt.key);
          return (
            <label
              key={opt.key}
              className="flex items-center gap-3 cursor-pointer text-[14px] text-[rgba(0,0,0,0.7)] hover:text-black"
            >
              <input
                type="checkbox"
                checked={isOn}
                onChange={() => onToggle(opt.key)}
                className="h-4 w-4 rounded border-[rgba(0,0,0,0.2)] accent-blue-500"
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
