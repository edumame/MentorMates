"use client";

import { useState, useMemo, useEffect } from "react";
import { EventsList } from "@/components/events/events-list";
import { EventItem } from "@/lib/types";
import { UI_TEXT } from "@/lib/config/constants";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/user/authentication/auth/AuthContext";
import { useAdmin } from "@/lib/hooks/use-admin";
import { Search, ChevronDown } from "lucide-react";
import { CreateEventModal } from "@/components/events/create-event-modal";

type SortOption = "date" | "name" | "type";

export function EventsPageClient({ eventsList }: { eventsList: EventItem[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const { isAuthenticated } = useAuth();
  const isAdmin = useAdmin();
  const [showCreateModal, setShowCreateModal] = useState(false);

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
    { value: "date", label: "By event date" },
    { value: "name", label: "By alphabetical" },
    { value: "type", label: "By date created" },
  ];

  const currentSortLabel = sortOptions.find((opt) => opt.value === sortBy)?.label || "Sort by";

  return (
    <div className="w-full">
      <div className="flex justify-between sm:gap-[15rem] mb-6 items-center flex-wrap">
        <h1 className="w-full sm:w-auto mb-4 sm:mb-0 text-[20px] sm:text-[28px] font-semibold leading-[1.4] tracking-[-0.06em] text-black">
          Events
        </h1>
        {/* Search and Filter Section */}
        <div className="flex flex-col gap-4 flex-1">
          <div className="flex items-end justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-[rgba(0,0,0,0.6)]">
                <Search className="w-full h-full" strokeWidth={2} />
              </div>
              <input
                type="text"
                placeholder="Search by event or host title"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-10 bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-12 py-2 text-xs sm:text-base font-normal text-black placeholder:text-[rgba(0,0,0,0.6)] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-4">
              {/* Sort By Dropdown */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSortMenu(!showSortMenu);
                  }}
                  className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 flex items-center gap-2 w-[150px] sm:min-w-[180px] hover:bg-gray-50 transition-colors justify-between h-10"
                >
                  <span className="text-xs sm:text-base font-normal text-black truncate">{currentSortLabel}</span>
                  <ChevronDown className="w-6 h-6 text-black flex-shrink-0" strokeWidth={2} />
                </button>
                {showSortMenu && (
                  <div className="absolute right-0 mt-2 w-44 sm:w-48 bg-white border border-[rgba(0,0,0,0.15)] rounded-xl shadow-lg z-20 py-1.5 px-1">
                    {sortOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setSortBy(option.value);
                          setShowSortMenu(false);
                        }}
                        className={`w-full text-left mb-1 px-4 py-2 hover:bg-[#F2F2F2] transition-colors rounded-xl ${sortBy === option.value ? "!bg-blue-50" : ""
                          }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Create Event Button - Desktop only */}
              {isAuthenticated && (
                <Button
                  className="h-10 hidden sm:inline-flex"
                  onClick={() => setShowCreateModal(true)}
                >
                  Create an event
                </Button>
              )}
            </div>
          </div>

          {/* Create Event Button - Mobile only */}
          {isAuthenticated && (
            <Button
              className="h-10 sm:hidden w-full"
              onClick={() => setShowCreateModal(true)}
            >
              Create an event
            </Button>
          )}
        </div>
      </div>

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

      {isAuthenticated && (
        <CreateEventModal
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
        />
      )}
    </div>
  );
}
