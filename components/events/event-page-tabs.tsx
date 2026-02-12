"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/features/user/authentication/auth/AuthContext";

interface EventPageTabsProps {
  eventId: string;
  participantCount?: number;
  projectCount?: number;
  showTicketsTab?: boolean;
  showParticipantsTab?: boolean;
}

export function EventPageTabs({
  eventId,
  participantCount,
  projectCount,
  showTicketsTab,
  showParticipantsTab = true,
}: EventPageTabsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();

  const tabs: Array<{
    name: string;
    path: string;
    badge?: number | null;
  }> = [
    { name: "Overview", path: `/events/${eventId}/overview` },
    { name: "Schedule", path: `/events/${eventId}/schedule`, badge: null },
  ];

  if (showParticipantsTab) {
    tabs.push({
      name: "Participants",
      path: `/events/${eventId}/participants`,
      badge: participantCount,
    });
  }

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

  if (showTicketsTab) {
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
      <div
        className={
          isAuthenticated
            ? "px-4 w-full"
            : "mx-auto w-full max-w-10xl px-4 md:px-10 lg:px-24"
        }
      >
        <div className="flex flex-wrap gap-x-4 gap-y-2 md:gap-x-6 items-start w-full">
          {tabs.map((tab) => {
            const isActive = pathname === tab.path;

            return (
              <Link
                key={tab.name}
                href={getHrefWithParams(tab.path)}
                className={`inline-flex gap-2 items-center px-0 py-2 ${
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
