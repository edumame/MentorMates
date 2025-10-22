"use client";

import { HackathonNav } from "@/components/layout/Hackathon-nav";
import { Badge } from "@/components/ui/badge";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ExpandMore, ExpandLess } from "@mui/icons-material";
import { EventVisibility } from "@/lib/types";

export interface EventHeaderProps {
  eventName: string;
  coverImageUrl?: string | null;
  eventDate?: string;
  location?: string;
  description?: string;
  eventId: string;
  submissionTimeStart?: string;
  submissionTimeCutoff?: string;
  visibility?: EventVisibility;
}

export function EventHeader({
  eventName,
  coverImageUrl,
  eventDate,
  location,
  description,
  eventId,
  submissionTimeStart,
  submissionTimeCutoff,
  visibility,
}: EventHeaderProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [needsTruncation, setNeedsTruncation] = useState(false);
  const contentRef = useRef<HTMLParagraphElement>(null);

  const getSubmissionStatus = () => {
    // "open" | "before" | "closed"
    const now = new Date();
    const start = submissionTimeStart ? new Date(submissionTimeStart) : null;
    const end = submissionTimeCutoff ? new Date(submissionTimeCutoff) : null;

    if (start && now < start) return "before";
    if (start && end && now >= start && now <= end) return "open";
    if (!start && end && now <= end) return "open";
    return "closed";
  };

  useEffect(() => {
    if (contentRef.current && description) {
      // Temporarily remove line-clamp to measure natural height
      const element = contentRef.current;
      const originalClassName = element.className;

      // Remove line-clamp classes to measure full content
      element.className = element.className
        .replace(/line-clamp-\d+|overflow-hidden/g, "")
        .trim();

      const fullHeight = element.scrollHeight;

      // Restore original classes
      element.className = originalClassName;

      // Calculate approximate height of 3 lines
      const lineHeight = parseInt(getComputedStyle(element).lineHeight);
      const approximateThreeLineHeight = lineHeight * 2;

      setNeedsTruncation(fullHeight > approximateThreeLineHeight);
    }
  }, [description, isExpanded]);

  return (
    <div
      className={`relative w-full ${
        isExpanded ? "h-auto" : "h-[350px] sm:h-[350px]"
      } rounded-lg overflow-hidden transition-all duration-300`}
    >
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: coverImageUrl
            ? `url(${coverImageUrl})`
            : "linear-gradient(to bottom right, #4F46E5, #3B82F6)",
        }}
      />
      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/60" />
      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-start pt-6 sm:pt-8 px-4 sm:px-8 pb-4 sm:pb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-3 sm:mb-4">
          {eventName}
        </h1>
        <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4">
          {eventDate && (
            <Badge
              variant="secondary"
              className="bg-white/10 text-white border-none text-xs sm:text-sm"
            >
              {eventDate}
            </Badge>
          )}
          {location && (
            <Badge
              variant="secondary"
              className="bg-white/10 text-white border-none text-xs sm:text-sm"
            >
              {location}
            </Badge>
          )}
          {(submissionTimeStart || submissionTimeCutoff) && (() => {
            const status = getSubmissionStatus();
            const badgeClass =
              status === "open"
                ? "bg-green-500/20 text-green-300"
                : status === "before"
                ? "bg-gray-500/20 text-gray-300"
                : "bg-red-500/20 text-red-300";
            const label =
              status === "open"
                ? "OPEN FOR SUBMISSION"
                : status === "before"
                ? "EVENT STARTING SOON"
                : "CLOSED FOR SUBMISSION";
            return (
              <Badge
                variant="secondary"
                className={`${badgeClass} border-none text-xs sm:text-sm`}
              >
                {label}
              </Badge>
            );
          })()}
          {visibility === EventVisibility.Archived && (
            <Badge
              variant="secondary"
              className="bg-orange-500/20 text-orange-300 border-none text-xs sm:text-sm"
            >
              📁 ARCHIVED
            </Badge>
          )}
          {visibility === EventVisibility.Unlisted && (
            <Badge
              variant="secondary"
              className="bg-gray-500/20 text-gray-200 border-none text-xs sm:text-sm"
            >
              🔗 UNLISTED
            </Badge>
          )}
          {visibility === EventVisibility.Private && (
            <Badge
              variant="secondary"
              className="bg-yellow-500/20 text-yellow-200 border-none text-xs sm:text-sm"
            >
              🔒 PRIVATE
            </Badge>
          )}
        </div>
        {description && (
          <div>
            <p
              ref={contentRef}
              className={`text-white/80 text-sm sm:text-base max-w-3xl ${
                isExpanded ? "" : "line-clamp-2 overflow-hidden"
              }`}
            >
              {description}
            </p>
            {needsTruncation && (
              <Button
                variant="ghost"
                size="sm"
                className="text-white/80 hover:text-white hover:bg-white/10 text-xs sm:text-sm mt-1"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <>
                    Show less{" "}
                    <ExpandLess className="ml-1 h-3 w-3 sm:h-4 sm:w-4" />
                  </>
                ) : (
                  <>
                    Show more{" "}
                    <ExpandMore className="ml-1 h-3 w-3 sm:h-4 sm:w-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        )}
        <div className="mt-auto">
          <HackathonNav id={eventId} />
        </div>
      </div>
    </div>
  );
}
