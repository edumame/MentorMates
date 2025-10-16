"use client";

import { data } from "@/lib/LearnData";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PageContainer, PageContent } from "@/components/layout/PageContainer";

export function LearnLayout() {
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<"all" | "bookmark">("all");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("learnBookmarks");
      if (raw) {
        const parsed = JSON.parse(raw) as Array<number>;
        setBookmarkedIds(new Set(parsed));
      }
    } catch {
      // ignore malformed data
    }
  }, []);

  const toggleBookmark = (id: number) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      try {
        localStorage.setItem(
          "learnBookmarks",
          JSON.stringify(Array.from(next))
        );
      } catch {
        // storage might be unavailable; fail silently
      }
      return next;
    });
  };
  return (
    <PageContainer>
      <PageContent className="px-8 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold">Learn</h1>
          <div className="flex gap-2">
            <button
              className={`px-3 py-1 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                activeTab === "all"
                  ? "bg-gray-100 text-gray-900"
                  : "bg-transparent text-gray-500 hover:bg-gray-100"
              }`}
              aria-pressed={activeTab === "all"}
              onClick={() => setActiveTab("all")}
            >
              All
            </button>
            <button
              className={`px-3 py-1 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                activeTab === "bookmark"
                  ? "bg-gray-100 text-gray-900"
                  : "bg-transparent text-gray-500 hover:bg-gray-100"
              }`}
              aria-pressed={activeTab === "bookmark"}
              onClick={() => setActiveTab("bookmark")}
            >
              Bookmark
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(activeTab === "bookmark"
          ? data.filter((d) => bookmarkedIds.has(d.id))
          : data
        ).map((item) => (
          <Link
            key={item.id}
            href={item.source}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col hover:shadow-md hover:border-gray-300 transition-all duration-200 group"
          >
            <div className="relative w-full aspect-video bg-black rounded-t-xl overflow-hidden flex items-center justify-center transition-transform duration-200">
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <Image
                  src={item.thumbnail}
                  alt={item.title}
                  fill
                  className="object-cover"
                />

                {item.video && (
                  <div className="flex items-center justify-center">
                    <svg
                      width="48"
                      height="48"
                      viewBox="0 0 48 48"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="drop-shadow-lg"
                    >
                      <circle
                        cx="24"
                        cy="24"
                        r="24"
                        fill="white"
                        fillOpacity="0.85"
                      />
                      <polygon points="20,16 34,24 20,32" fill="#222" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 flex-1 flex flex-col">
              <h2 className="text-base font-semibold mb-1 group-hover:text-blue-600 transition-colors">
                {item.title}
              </h2>
              <p className="text-sm text-gray-600 mb-4">{item.description}</p>
              <div className="flex items-center justify-between mt-auto">
                <div className="flex items-center gap-1 text-gray-500 text-xs">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    fill="none"
                    viewBox="0 0 24 24"
                    className="inline-block"
                  >
                    <path
                      d="M12 8V12L14.5 13.5M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {item.readingTime} min
                </div>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-gray-100 transition-colors"
                  aria-label="Bookmark"
                  aria-pressed={bookmarkedIds.has(item.id)}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleBookmark(item.id);
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    fill={bookmarkedIds.has(item.id) ? "currentColor" : "none"}
                    viewBox="0 0 24 24"
                    className={
                      bookmarkedIds.has(item.id)
                        ? "text-blue-600"
                        : "text-gray-500"
                    }
                  >
                    <path
                      d="M6 4C5.44772 4 5 4.44772 5 5V20.382C5 21.2678 6.07714 21.7132 6.70711 21.0822L12 15.7893L17.2929 21.0822C17.9229 21.7132 19 21.2678 19 20.382V5C19 4.44772 18.5523 4 18 4H6Z"
                      stroke={
                        bookmarkedIds.has(item.id) ? "none" : "currentColor"
                      }
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </Link>
        ))}
        </div>
        {activeTab === "bookmark" &&
          data.every((d) => !bookmarkedIds.has(d.id)) && (
            <div className="text-sm text-gray-500 mt-6">No bookmarks yet.</div>
          )}
      </PageContent>
    </PageContainer>
  );
}
