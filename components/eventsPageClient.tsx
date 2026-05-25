"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { EventsList } from "@/components/events/events-list";
import { EventItem, EventRole } from "@/lib/types";
import { UI_TEXT } from "@/lib/config/constants";
import { Button } from "@/components/ui/button";
import { EventSearchInput } from "@/components/ui/event-search-input";
import { useAuth } from "@/features/user/authentication/auth/AuthContext";
import { CreateEventModal } from "@/components/events/create-event-modal";
import { parseEventDateLocal } from "@/lib/utils/date";

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

type DateBucket = "past" | "today" | "tomorrow" | "thisWeek" | "nextWeek" | "later";

const DATE_BUCKET_LABEL: Record<DateBucket, string> = {
  past: "Past events",
  today: "Today",
  tomorrow: "Tomorrow",
  thisWeek: "This week",
  nextWeek: "Next week",
  later: "Later",
};

function bucketForDate(eventDate: string): DateBucket {
  const parsed = parseEventDateLocal(eventDate);
  if (!parsed) return "later";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const eventStart = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
  const diffDays = Math.round((eventStart - startOfToday) / dayMs);
  if (diffDays < 0) return "past";
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays <= 7) return "thisWeek";
  if (diffDays <= 14) return "nextWeek";
  return "later";
}

const DATE_ORDER: DateBucket[] = ["today", "tomorrow", "thisWeek", "nextWeek", "later", "past"];

export function EventsPageClient({
  eventsList,
  initialIsAuthenticated,
}: EventsPageClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("discover");
  const [selectedLocations, setSelectedLocations] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
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
      (e) => e.userRole === EventRole.Participant || e.userRole === EventRole.Judge || e.userRole === EventRole.Mentor
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
      return true;
    });
  }, [tabFilteredEvents, searchTerm, selectedLocations, selectedTypes]);

  const featuredEvents = useMemo(
    () => filteredEvents.filter((e) => e.featured).slice(0, 6),
    [filteredEvents]
  );

  const groupedByDate = useMemo(() => {
    const buckets: Record<DateBucket, EventWithRole[]> = {
      past: [],
      today: [],
      tomorrow: [],
      thisWeek: [],
      nextWeek: [],
      later: [],
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

  const totalVisible = filteredEvents.length;

  const toggleLocation = (key: string) => {
    setSelectedLocations((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleType = (key: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const clearFilters = () => {
    setSelectedLocations(new Set());
    setSelectedTypes(new Set());
  };

  const hasActiveFilters = selectedLocations.size > 0 || selectedTypes.size > 0;

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
                className={`h-10 hidden sm:inline-flex ${onboardingRole === "organizer" ? "animate-bounce" : ""}`}
                onClick={() => setShowCreateModal(true)}
              >
                Create an event
              </Button>
            )}
          </div>
          {isAuthenticated && (
            <Button
              className={`h-10 sm:hidden w-full ${onboardingRole === "organizer" ? "animate-bounce" : ""}`}
              onClick={() => setShowCreateModal(true)}
            >
              Create an event
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">
        <div className="min-w-0">
          <div
            role="tablist"
            aria-label="Events tabs"
            className="flex items-center gap-6 border-b border-[rgba(0,0,0,0.08)] mb-6"
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
                  className={`relative pb-3 pt-2 text-[15px] font-semibold tracking-[-0.05%] transition-colors ${
                    isActive ? "text-black" : "text-[rgba(0,0,0,0.5)] hover:text-black"
                  }`}
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
                  <EventsList events={featuredEvents} />
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
                    <EventsList events={items} />
                  </section>
                );
              })}
            </div>
          )}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-6 flex flex-col gap-6">
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
                className="text-[13px] font-medium text-[rgba(0,0,0,0.6)] hover:text-black underline-offset-2 hover:underline self-start"
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
    <div className="rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white p-5">
      <p className="font-semibold text-black text-[15px] mb-3">{title}</p>
      <div className="flex flex-col gap-3">
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
