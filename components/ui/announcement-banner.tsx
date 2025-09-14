"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type AnnouncementBannerProps = {
  href: string;
  className?: string;
  message?: string;
  ctaText?: string;
};

export function AnnouncementBanner({
  href,
  className,
  message = "We just launched the AI Vibe Guide — check it out.",
  ctaText = "View guide",
}: AnnouncementBannerProps) {
  return (
    <Link
      href={href}
      aria-label="View the AI Vibe Guide"
      className={cn(
        "block w-full border-b border-blue-100 bg-blue-50/70 text-blue-900 hover:bg-blue-50 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 focus-visible:ring-offset-white",
        "dark:focus-visible:ring-offset-gray-900",
        className
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5">
        <div className="w-full flex items-center justify-between gap-3">
          <span className="text-[13px] sm:text-sm font-medium">{message}</span>
          <span
            className={cn(
              "text-[13px] sm:text-sm font-semibold text-blue-700 underline underline-offset-4 decoration-blue-300"
            )}
          >
            {ctaText}
          </span>
        </div>
      </div>
    </Link>
  );
}

