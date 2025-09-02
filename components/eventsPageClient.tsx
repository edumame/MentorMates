"use client";

import { useState, useMemo } from "react";
import { EventsList } from "@/components/events/events-list";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { EventItem, EventVisibility } from "@/lib/types";
import { UI_TEXT, DEFAULT_VALUES } from "@/lib/config/constants";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/lib/hooks/use-toast";
import Link from "next/link";

export function EventsPageClient({ eventsList, isAdmin }: { eventsList: EventItem[]; isAdmin?: boolean }) {
  const [searchTerm, setSearchTerm] = useState(DEFAULT_VALUES.SEARCH_TERM);
  const [hidePaid, setHidePaid] = useState(false);
  const { toast } = useToast();

  // Creating is now done on a separate page

  const filteredEvents = useMemo(() => {
    return eventsList.filter((event) =>
      event.event_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [eventsList, searchTerm]);

  const visibleEvents = useMemo(() => {
    if (!hidePaid) return filteredEvents;
    return filteredEvents.filter((event) => event.paid !== true);
  }, [filteredEvents, hidePaid]);

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-6 sm:py-8">
      <div className="relative w-full mb-6 sm:mb-8">
        <Input
          type="text"
          placeholder={UI_TEXT.SEARCH_PLACEHOLDER}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10"
        />
        <svg
          className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      <div className="flex justify-between items-center mb-6 gap-4 flex-col sm:flex-row">
        {isAdmin ? (
          <div className="w-full">
            <Button asChild>
              <Link href="/events/new">Create an event</Link>
            </Button>
          </div>
        ) : null }
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Hide Paid</span>
          <Switch checked={hidePaid} onCheckedChange={setHidePaid} />
        </div>
      </div>

      {visibleEvents.length > 0 ? (
        <EventsList events={visibleEvents} />
      ) : (
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
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No events found
          </h3>
          <p className="text-gray-500 max-w-sm">
            {searchTerm
              ? `No events match your search "${searchTerm}". Try adjusting your search terms.`
              : UI_TEXT.NO_EVENTS_FOUND}
          </p>
        </div>
      )}
    </div>
  );
}
