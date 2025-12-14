"use client";

import { data, LearnItem } from "@/lib/LearnData";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageContainer, PageContent } from "@/components/layout/PageContainer";
import { MentorCards } from "./MentorCards";
import { supabase } from "@/lib/supabase";
import { Lesson } from "@/lib/types";

export function LearnLayout() {
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<"all" | "bookmark">("all");
  const [exclusiveLessons, setExclusiveLessons] = useState<LearnItem[]>([]);

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

  useEffect(() => {
    const fetchExclusiveLessons = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        // Fetch event IDs the user has any role in (joined/organizer/mentor/judge)
        const { data: roles } = await supabase
          .from("user_event_roles")
          .select("event_id")
          .eq("user_id", session.user.id);
        const eventIds = (roles || []).map((r: { event_id: string }) => r.event_id);
        if (eventIds.length === 0) return;

        const { data: lessonsRows } = await supabase
          .from("event_lessons")
          .select("event_id,title,cover_image_url,url,description,duration_minutes")
          .in("event_id", eventIds);

        const flatLessons: LearnItem[] = [];

        // Use a large offset to ensure exclusive lesson IDs don't collide with static lesson IDs
        const EXCLUSIVE_LESSON_ID_OFFSET = 2_000_000_000;

        const hash = (s: string) => {
          let h = 0;
          for (let i = 0; i < s.length; i++) {
            h = (h << 5) - h + s.charCodeAt(i);
            h |= 0;
          }
          return EXCLUSIVE_LESSON_ID_OFFSET + Math.abs(h);
        };

        type EventLessonRow = Lesson & { event_id: string };
        (lessonsRows || []).forEach((row: EventLessonRow) => {
          const id = hash(`${row.event_id}|${row.title}|${row.url}`);
          flatLessons.push({
            id,
            title: row.title,
            description: row.description,
            source: row.url,
            readingTime: row.duration_minutes,
            thumbnail: row.cover_image_url,
            video: false,
          });
        });

        setExclusiveLessons(flatLessons);
      } catch (e) {
        console.error("Failed to fetch exclusive lessons", e);
      }
    };

    fetchExclusiveLessons();
  }, []);

  const allItems: LearnItem[] = useMemo(() => {
    // Merge static learn data and exclusive lessons
    return [...data, ...exclusiveLessons];
  }, [exclusiveLessons]);

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
      <PageContent className="pt-[24px] pb-8">
        <div className="flex flex-col gap-[24px] px-[32px]">
        <div className="flex items-center justify-between">
          <h1 className="text-[20px] sm:text-[28px] font-semibold leading-[1.4] tracking-[-0.06em] text-black">Learn</h1>
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
        <MentorCards />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(activeTab === "bookmark"
          ? allItems.filter((d) => bookmarkedIds.has(d.id))
          : allItems
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
                <img
                  src={item.thumbnail}
                  alt={item.title}
                  className="absolute inset-0 w-full h-full object-cover"
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
          allItems.every((d) => !bookmarkedIds.has(d.id)) && (
            <div className="text-sm text-gray-500 mt-6">No bookmarks yet.</div>
          )}
        </div>
      </PageContent>
    </PageContainer>
  );
}
