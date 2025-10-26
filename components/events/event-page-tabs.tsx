"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

interface EventPageTabsProps {
  eventId: string;
  participantCount?: number;
  projectCount?: number;
}

export function EventPageTabs({
  eventId,
  participantCount,
  projectCount,
}: EventPageTabsProps) {
  const pathname = usePathname();
  console.log(pathname)
  const searchParams = useSearchParams();

  const tabs = [
    { name: "Overview", path: `/events/${eventId}/overview` },
    { name: "Schedule", path: `/events/${eventId}/schedule`, badge: null },
    {
      name: "Participants",
      path: `/events/${eventId}/participants`,
      badge: participantCount,
    },
    {
      name: "Projects",
      path: `/events/${eventId}/projects`,
      badge: projectCount,
    },
    { name: "FAQs", path: `/events/${eventId}/faqs` },
    { name: "Gallery", path: `/events/${eventId}/gallery` }, // TODO: Add back when image upload functionality is ready
  ];

  // Helper function to preserve query params
  const getHrefWithParams = (path: string) => {
    const params = new URLSearchParams(searchParams);
    const queryString = params.toString();
    return queryString ? `${path}?${queryString}` : path;
  };

  return (
    <div className="border-b border-[#f2f2f2] w-full overflow-x-auto">
      <div className="flex gap-6 items-start px-6 w-full">
        {tabs.map((tab) => {
          const isActive = pathname === tab.path;

          return (
            <Link
              key={tab.name}
              href={getHrefWithParams(tab.path)}
              className={`flex gap-2 items-center px-0 py-2 ${isActive ? "border-b-2 border-[#4b89ef]" : ""
                }`}
            >
              <p
                className={`${isActive ? "font-medium" : "font-normal"
                  } text-base text-black`}
              >
                {tab.name}
              </p>
              {tab.badge !== null && tab.badge !== undefined && (
                <div className="border border-[rgba(0,0,0,0.15)] flex gap-3 items-start px-2 rounded-[50px]">
                  <p className="font-normal text-xs md:text-sm text-black">{tab.badge}</p>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
