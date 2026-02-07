import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/app/utils/supabase/client";
import { Badge } from "@/components/ui/badge";
import { getRoleLabel } from "@/features/user/roles/roles";
import { EventCard } from "@/components/events/event-card";
import { EventSearchInput } from "@/components/ui/event-search-input";
import { EventItem, EventVisibility, ApprovalStatus } from "@/lib/types";
import { ChevronDown } from "lucide-react";
import { useAdmin } from "@/lib/hooks/use-admin";

type APIEvent = {
  event_id?: string | number;
  id?: string | number;
  event_name?: string | null;
  event_date?: string | null;
  location?: string | null;
  cover_image_url?: string | null;
  slug?: string | null;
  event_blurb?: string | null;
  event_description?: string | null;
  role_labels?: Record<string, string> | null;
  user_event_roles?: { role: number }[];
  visibility?: EventVisibility | null;
  approval_status?: ApprovalStatus | null;
};

type UIEvent = {
  id: string;
  title: string;
  dateISO: string | null;
  location: string;
  image: string;
  href: string;
  slug?: string;
  blurb?: string;
  description?: string;
  roleLabel?: string;
  visibility?: EventVisibility;
  approvalStatus?: ApprovalStatus;
};

function toEventItem(event: UIEvent): EventItem {
  return {
    event_id: event.id,
    // Prefer linking by id; slug is optional and can be omitted
    event_name: event.title,
    event_date: event.dateISO ?? "",
    location: event.location,
    cover_image_url: event.image,
    slug: event.slug,
    event_blurb: event.blurb,
    event_description: event.description,
  };
}

type SortOption = "date" | "name" | "type";

export function MyEvents() {
  const [events, setEvents] = useState<UIEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [selectedApprovalStatus, setSelectedApprovalStatus] = useState<ApprovalStatus | "all">("all");
  const [selectedVisibility, setSelectedVisibility] = useState<EventVisibility | "all">("all");
  const [showApprovalFilter, setShowApprovalFilter] = useState(false);
  const [showVisibilityFilter, setShowVisibilityFilter] = useState(false);
  const isAdmin = useAdmin();

  useEffect(() => {
    const supabase = createClient();

    const fetchMyEvents = async () => {
      setLoading(true);
      setError(null);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const uid = session?.user?.id;
        if (!uid) {
          setEvents([]);
          setLoading(false);
          return;
        }

        const res = await fetch(`/api/users/${uid}/profile`, {
          credentials: "include",
          headers: { "cache-control": "no-store" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        const rawEvents: APIEvent[] = payload.events || [];

        const uiEvents: UIEvent[] = rawEvents.map((e) => {
          const id = String(e.event_id ?? e.id ?? "");
          const dateISO = e.event_date ?? null;
          const roleLabel = e.user_event_roles?.[0]?.role
            ? getRoleLabel(String(e.user_event_roles[0].role), e.role_labels)
            : undefined;
          return {
            id,
            title: e.event_name ?? "Untitled Event",
            dateISO,
            location: e.location ?? "Online",
            // IMPORTANT: keep this empty when the event has no cover image.
            // `EventCard` already has a default gradient background for "no image",
            // and we want Home + Events dashboard cards to look the same.
            image: e.cover_image_url ?? "",
            href: e.slug ? `/events/${e.slug}` : `/events/${id}`,
            slug: e.slug ?? undefined,
            blurb: e.event_blurb ?? undefined,
            description: e.event_description ?? undefined,
            roleLabel,
            visibility: e.visibility as EventVisibility,
            approvalStatus: e.approval_status as ApprovalStatus,
          };
        });

        setEvents(uiEvents);
      } catch {
        setError("Failed to load your events");
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMyEvents();
  }, []);

  const filteredAndSortedEvents = useMemo(() => {
    // First filter by search term
    let filtered = events.filter((event) =>
      event.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Filter by approval status
    if (selectedApprovalStatus !== "all") {
      filtered = filtered.filter(
        (event) => event.approvalStatus === selectedApprovalStatus
      );
    }

    // Filter by visibility
    if (selectedVisibility !== "all") {
      filtered = filtered.filter(
        (event) => event.visibility === selectedVisibility
      );
    }

    // Then sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "date":
          if (!a.dateISO || !b.dateISO) return 0;
          return new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime();
        case "name":
          return a.title.localeCompare(b.title);
        case "type":
          // Sort by date created (using id as proxy, or keep original order)
          // Since we don't have created_at, we'll use a stable sort
          return 0;
        default:
          return 0;
      }
    });

    return sorted;
  }, [events, searchTerm, sortBy, selectedApprovalStatus, selectedVisibility]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (showSortMenu) {
        setShowSortMenu(false);
      }
      if (showApprovalFilter) {
        setShowApprovalFilter(false);
      }
      if (showVisibilityFilter) {
        setShowVisibilityFilter(false);
      }
    };

    if (showSortMenu || showApprovalFilter || showVisibilityFilter) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [showSortMenu, showApprovalFilter, showVisibilityFilter]);

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: "date", label: "By event date" },
    { value: "name", label: "By alphabetical" },
    { value: "type", label: "By date created" },
  ];

  const approvalStatusOptions: { value: ApprovalStatus | "all"; label: string }[] = [
    { value: "all", label: "All statuses" },
    { value: ApprovalStatus.Approved, label: "Approved" },
    { value: ApprovalStatus.Submitted, label: "Submitted" },
    { value: ApprovalStatus.NotSubmitted, label: "Not Submitted" },
    { value: ApprovalStatus.Rejected, label: "Rejected" },
  ];

  const adminVisibilityOptions: { value: EventVisibility | "all"; label: string }[] = [
    { value: "all", label: "All visibilities" },
    { value: EventVisibility.Public, label: "Public" },
    { value: EventVisibility.Private, label: "Private" },
    { value: EventVisibility.Draft, label: "Draft" },
    { value: EventVisibility.Archived, label: "Archived" },
    { value: EventVisibility.Test, label: "Test" },
    { value: EventVisibility.Demo, label: "Demo" },
  ];

  const visibilityOptions: { value: EventVisibility | "all"; label: string }[] = useMemo(() => {
    return isAdmin ? adminVisibilityOptions : [
      { value: "all", label: "All visibilities" },
      { value: EventVisibility.Public, label: "Public" },
      { value: EventVisibility.Private, label: "Private" },
      { value: EventVisibility.Draft, label: "Draft" },
      { value: EventVisibility.Archived, label: "Archived" },
    ];
  }, [isAdmin]);

  const currentSortLabel = sortOptions.find((opt) => opt.value === sortBy)?.label || "Sort by";
  const currentApprovalLabel = approvalStatusOptions.find((opt) => opt.value === selectedApprovalStatus)?.label || "All statuses";
  const currentVisibilityLabel = visibilityOptions.find((opt) => opt.value === selectedVisibility)?.label || "All visibilities";

  return (
    <section className="w-full">
      <div className="flex justify-between items-center mb-3 flex-wrap gap-4">
        <h2 className="text-2xl font-semibold">My events</h2>
        
        {/* Search and Sort Section */}
        {!loading && !error && events.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap w-full sm:w-auto">
            {/* Search Input */}
            <EventSearchInput
              wrapperClassName="w-full sm:w-[240px]"
              placeholder="Search events"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              inputClassName="text-sm sm:text-sm"
            />

            {/* Sort By Dropdown */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSortMenu(!showSortMenu);
                }}
                className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 flex items-center gap-2 w-[140px] hover:bg-gray-50 transition-colors justify-between h-10"
              >
                <span className="text-sm font-normal text-black truncate">{currentSortLabel}</span>
                <ChevronDown className="w-4 h-4 text-black flex-shrink-0" strokeWidth={2} />
              </button>
              {showSortMenu && (
                <div className="absolute right-0 mt-2 w-40 bg-white border border-[rgba(0,0,0,0.15)] rounded-xl shadow-lg z-20 py-1.5 px-1">
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setSortBy(option.value);
                        setShowSortMenu(false);
                      }}
                      className={`w-full text-left mb-1 px-3 py-2 text-sm hover:bg-[#F2F2F2] transition-colors rounded-xl ${sortBy === option.value ? "!bg-blue-50" : ""
                        }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Approval Status Filter */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowApprovalFilter(!showApprovalFilter);
                }}
                className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 flex items-center gap-2 w-[140px] hover:bg-gray-50 transition-colors justify-between h-10"
              >
                <span className="text-sm font-normal text-black truncate">{currentApprovalLabel}</span>
                <ChevronDown className="w-4 h-4 text-black flex-shrink-0" strokeWidth={2} />
              </button>
              {showApprovalFilter && (
                <div className="absolute left-0 mt-2 w-40 bg-white border border-[rgba(0,0,0,0.15)] rounded-xl shadow-lg z-20 py-1.5 px-1">
                  {approvalStatusOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setSelectedApprovalStatus(option.value);
                        setShowApprovalFilter(false);
                      }}
                      className={`w-full text-left mb-1 px-3 py-2 text-sm hover:bg-[#F2F2F2] transition-colors rounded-xl ${selectedApprovalStatus === option.value ? "!bg-blue-50" : ""
                        }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Visibility Filter */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowVisibilityFilter(!showVisibilityFilter);
                }}
                className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 flex items-center gap-2 w-[140px] hover:bg-gray-50 transition-colors justify-between h-10"
              >
                <span className="text-sm font-normal text-black truncate">{currentVisibilityLabel}</span>
                <ChevronDown className="w-4 h-4 text-black flex-shrink-0" strokeWidth={2} />
              </button>
              {showVisibilityFilter && (
                <div className="absolute left-0 mt-2 w-40 bg-white border border-[rgba(0,0,0,0.15)] rounded-xl shadow-lg z-20 py-1.5 px-1">
                  {visibilityOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setSelectedVisibility(option.value);
                        setShowVisibilityFilter(false);
                      }}
                      className={`w-full text-left mb-1 px-3 py-2 text-sm hover:bg-[#F2F2F2] transition-colors rounded-xl ${selectedVisibility === option.value ? "!bg-blue-50" : ""
                        }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-gray-500">Loading your events…</div>
      ) : error ? (
        <div className="text-red-600">{error}</div>
      ) : events.length === 0 ? (
        <div className="text-gray-500">
          You are not registered for any events yet.
        </div>
      ) : filteredAndSortedEvents.length === 0 ? (
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
            {searchTerm || selectedApprovalStatus !== "all" || selectedVisibility !== "all"
              ? `No events match your ${searchTerm ? `search "${searchTerm}"` : ""}${searchTerm && (selectedApprovalStatus !== "all" || selectedVisibility !== "all") ? " and " : ""}${selectedApprovalStatus !== "all" || selectedVisibility !== "all" ? "filters" : ""}. Try adjusting your search terms or filters.`
              : "No events found."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-3 min-[1064px]:grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-5 sm:auto-rows-fr">
          {filteredAndSortedEvents.map((e) => (
            <div key={e.id} className="relative w-full max-w-[420px] mx-auto">
              <EventCard event={toEventItem(e)} />
              {e.roleLabel && (
                <div className="absolute top-3 left-3 z-10">
                  <Badge
                    variant="secondary"
                    className="rounded-full bg-gray-100 text-gray-700 mr-2"
                  >
                    {e.roleLabel}
                  </Badge>

                  {e.visibility === EventVisibility.Draft && (
                    <Badge
                      variant="secondary"
                      className="rounded-full bg-yellow-300 text-gray-700 hover:bg-yellow-200"
                    >
                      Draft
                    </Badge>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
