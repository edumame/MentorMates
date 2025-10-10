"use client";

import { useState, useMemo, useEffect } from "react";
import { EventsList } from "@/components/events/events-list";
import { EventItem } from "@/lib/types";
import { UI_TEXT } from "@/lib/config/constants";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Search, ChevronDown } from "lucide-react";

type SortOption = "date" | "name" | "type";

export function EventsPageClient({ eventsList }: { eventsList: EventItem[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [showSortMenu, setShowSortMenu] = useState(false);

  const filteredAndSortedEvents = useMemo(() => {
    // First filter by search term
    const filtered = eventsList.filter((event) =>
      event.event_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Then sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "date":
          return new Date(b.event_date).getTime() - new Date(a.event_date).getTime();
        case "name":
          return a.event_name.localeCompare(b.event_name);
        case "type": {
          const aPaid = a.paid || a.stripe_price_id ? 1 : 0;
          const bPaid = b.paid || b.stripe_price_id ? 1 : 0;
          return bPaid - aPaid; // Paid events first
        }
        default:
          return 0;
      }
    });

    return sorted;
  }, [eventsList, searchTerm, sortBy]);

  useEffect(() => {
    async function checkSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setIsLoggedIn(!!session);
      } catch (error) {
        console.error("Error checking session:", error);
      }
    }
    checkSession();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (showSortMenu) {
        setShowSortMenu(false);
      }
    };

    if (showSortMenu) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [showSortMenu]);

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: "date", label: "By Date" },
    { value: "name", label: "By Name" },
    { value: "type", label: "By Type" },
  ];

  const currentSortLabel = sortOptions.find((opt) => opt.value === sortBy)?.label || "Sort by";

  return (
    <div className="w-full">
      {/* Search and Filter Section */}
      <div className="flex items-end justify-between pb-6 gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-[rgba(0,0,0,0.6)]">
            <Search className="w-full h-full" strokeWidth={2} />
          </div>
          <input
            type="text"
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-12 py-2 text-xs sm:text-base font-normal text-black placeholder:text-[rgba(0,0,0,0.6)] focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Sort By Dropdown */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowSortMenu(!showSortMenu);
            }}
            className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 flex items-center gap-2 w-[107px] sm:min-w-[160px] hover:bg-gray-50 transition-colors justify-between h-10"
          >
            <span className="text-xs sm:text-base font-normal text-black truncate">{currentSortLabel}</span>
            <ChevronDown className="w-6 h-6 text-black flex-shrink-0" strokeWidth={2} />
          </button>
          {showSortMenu && (
            <div className="absolute right-0 mt-2 w-full sm:w-48 bg-white border border-[rgba(0,0,0,0.15)] rounded-xl shadow-lg z-10">
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setSortBy(option.value);
                    setShowSortMenu(false);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors first:rounded-t-xl last:rounded-b-xl ${
                    sortBy === option.value ? "bg-blue-50 font-semibold" : ""
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Event Button */}
      {isLoggedIn && (
        <div className="mb-6">
          <Button asChild>
            <Link href="/events/new">Create an event</Link>
          </Button>
        </div>
      )}

      {/* Events List */}
      {filteredAndSortedEvents.length > 0 ? (
        <EventsList events={filteredAndSortedEvents} />
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
