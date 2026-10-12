"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useActiveRole } from "./ActiveRoleContext";
import { EVENT_PAGE_SHELL_CLASS } from "./event-page-shell";
import { EventRole } from "@/lib/types";

interface EventPageTabsProps {
  eventId: string;
  participantCount?: number;
  projectCount?: number;
  showTicketsTab?: boolean;
  showParticipantsTab?: boolean;
  showTeamTab?: boolean;
}

export function EventPageTabs({
  eventId,
  participantCount,
  projectCount,
  showTicketsTab,
  showParticipantsTab = true,
  showTeamTab = false,
}: EventPageTabsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { activeRole } = useActiveRole();

  // Judges only need the Overview tab — the scoring UI is embedded there
  const isJudge = activeRole === EventRole.Judge;

  const tabs: Array<{
    name: string;
    path: string;
    badge?: number | null;
  }> = [
    { name: "Overview", path: `/events/${eventId}/overview` },
  ];

  if (!isJudge) {
    tabs.push({ name: "Schedule", path: `/events/${eventId}/schedule`, badge: null });
  }

  if (!isJudge && showParticipantsTab) {
    tabs.push({
      name: "Participants",
      path: `/events/${eventId}/participants`,
      badge: participantCount,
    });
  }

  if (!isJudge && showTeamTab) {
    tabs.push({ name: "Team", path: `/events/${eventId}/team` });
  }

  if (!isJudge) {
    tabs.push({
      name: "Projects",
      path: `/events/${eventId}/gallery`,
      badge: projectCount,
    });

    tabs.push({
      name: "Voting",
      path: `/events/${eventId}/voting`,
    });

    tabs.push({ name: "FAQs", path: `/events/${eventId}/faqs` });
    // { name: "Gallery", path: `/events/${eventId}/gallery` }, // TODO: Add back when image upload functionality is ready
  }

  if (!isJudge && showTicketsTab) {
    tabs.push({ name: "Tickets", path: `/events/${eventId}/tickets` });
  }

  // Helper function to preserve query params
  const getHrefWithParams = (path: string) => {
    const params = new URLSearchParams(searchParams);
    const queryString = params.toString();
    return queryString ? `${path}?${queryString}` : path;
  };

  return (
    <div className="border-b border-[#f2f2f2] w-full">
      <div className={EVENT_PAGE_SHELL_CLASS}>
        <div className="flex gap-4 md:gap-6 items-start w-full overflow-x-auto no-scrollbar whitespace-nowrap">
          {tabs.map((tab) => {
            const isActive = pathname === tab.path;

            return (
              <Link
                key={tab.name}
                href={getHrefWithParams(tab.path)}
                className={`inline-flex gap-2 items-center px-0 py-2 flex-shrink-0 ${
                  isActive ? "border-b-2 border-[#4b89ef]" : ""
                }`}
              >
                <p
                  className={`${
                    isActive ? "font-medium" : "font-normal"
                  } text-base text-black`}
                >
                  {tab.name}
                </p>
                {tab.badge !== null && tab.badge !== undefined && (
                  <div className="border border-[rgba(0,0,0,0.15)] flex gap-3 items-start px-2 rounded-[50px] flex-shrink-0">
                    <p className="font-normal text-xs md:text-sm text-black">
                      {tab.badge}
                    </p>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
