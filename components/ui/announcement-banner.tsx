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
  message = "Hey, we just launched a book — come purchase it.",
  ctaText = "Buy the Book",
}: AnnouncementBannerProps) {
  return (
    <Link
      href={href}
      aria-label="Purchase the book"
      className={cn(
        "block w-full bg-gradient-to-r from-blue-700 via-indigo-600 to-purple-600 text-white",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-white",
        "dark:focus-visible:ring-offset-gray-900",
        className
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="w-full flex items-center justify-between gap-3">
          <span className="text-sm sm:text-base font-medium">{message}</span>
          <span
            className={cn(
              "inline-flex items-center rounded-md bg-white/90 text-indigo-700 px-3 py-1",
              "text-xs sm:text-sm font-semibold shadow-sm",
              "hover:bg-white transition-colors"
            )}
          >
            {ctaText}
          </span>
        </div>
      </div>
    </Link>
  );
}

