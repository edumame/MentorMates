"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface EventPageTabsProps {
  eventId: string;
}

export function EventPageTabs({ eventId }: EventPageTabsProps) {
  const pathname = usePathname();

  const tabs = [
    { name: "Overview", path: `/events/${eventId}/overview` },
    { name: "Schedule", path: `/events/${eventId}/schedule`, badge: null },
    { name: "Participants", path: `/events/${eventId}/participants`, badge: 3 },
    { name: "Projects", path: `/events/${eventId}/gallery`, badge: 3 },
    { name: "FAQs", path: `/events/${eventId}/faqs` },
    { name: "Gallery", path: `/events/${eventId}/gallery` },
  ];

  return (
    <div className="border-b border-[#f2f2f2] flex gap-6 items-start px-6 w-full">
      {tabs.map((tab) => {
        const isActive = pathname === tab.path;

        return (
          <Link
            key={tab.name}
            href={tab.path}
            className={`flex gap-2 items-center px-0 py-2 ${
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
              <div className="border border-[rgba(0,0,0,0.15)] flex gap-3 items-start px-2 rounded-[50px]">
                <p className="font-normal text-sm text-black">{tab.badge}</p>
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}
