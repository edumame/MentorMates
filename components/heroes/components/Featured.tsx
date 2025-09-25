"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type APIEvent = {
  event_id?: string | number;
  id?: string | number;
  event_name?: string | null;
  event_description?: string | null;
  event_blurb?: string | null;
  event_date?: string | null; // may be missing if unauth per your route
  location?: string | null;
  category?: string | null;
  cover_image_url?: string | null;
  slug?: string | null;
  // visibility, userRole, etc. may appear but are not required here
};

type UIEvent = {
  id: string;
  title: string;
  description: string;
  dateISO: string | null;
  dateLabel: string;
  location: string;
  category: string;
  image: string;
  href: string;
};

const fmtDate = (iso?: string | null) => {
  if (!iso) return "TBD";
  try {
    return new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "TBD";
  }
};

const getDateParts = (iso?: string | null) => {
  if (!iso) return { dow: "", day: "", monYear: "" };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { dow: "", day: "", monYear: "" };
  const dow = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(d);
  const day = new Intl.DateTimeFormat("en-US", { day: "2-digit" }).format(d);
  const mon = new Intl.DateTimeFormat("en-US", { month: "short" }).format(d);
  const year = new Intl.DateTimeFormat("en-US", { year: "numeric" }).format(d);
  return { dow, day, monYear: `${mon} ${year}` };
};

// local helper: pick nearest N (upcoming first, then most recent past).
function pickNearest<T extends { event_date?: string | null }>(
  list: T[],
  n: number
): T[] {
  const withDate = list.filter(
    (e) => e.event_date && !Number.isNaN(Date.parse(e.event_date as string))
  );
  if (withDate.length === 0) return list.slice(0, n); // graceful fallback

  const now = Date.now();
  const upcoming = withDate
    .filter((e) => Date.parse(e.event_date as string) >= now)
    .sort(
      (a, b) =>
        Date.parse(a.event_date as string) - Date.parse(b.event_date as string)
    );
  const past = withDate
    .filter((e) => Date.parse(e.event_date as string) < now)
    .sort(
      (a, b) =>
        Date.parse(b.event_date as string) - Date.parse(a.event_date as string)
    );

  const result: T[] = [];
  for (const e of upcoming) {
    if (result.length < n) result.push(e);
    else break;
  }
  for (const e of past) {
    if (result.length < n) result.push(e);
    else break;
  }
  return result;
}

export function Featured() {
  const [events, setEvents] = useState<UIEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const ac = new AbortController();

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/events", {
          credentials: "include",
          signal: ac.signal,
          headers: { "cache-control": "no-store" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload: { events?: APIEvent[] } = await res.json();
        const all = payload.events ?? [];

        // compute nearest 3 on the client
        const nearest3 = pickNearest(all, 3);

        const ui: UIEvent[] = nearest3.map((e) => {
          const id = String(e.event_id ?? e.id ?? "");
          const dateISO = e.event_date ?? null;
          return {
            id,
            title: e.event_name ?? "Untitled Event",
            description:
              e.event_blurb ??
              e.event_description ??
              "No description available",
            dateISO,
            dateLabel: fmtDate(dateISO),
            location: e.location ?? "Online",
            category: e.category ?? "General",
            image: e.cover_image_url ?? "/img/placeholder.png",
            href: e.slug ? `/events/${e.slug}` : `/events/${id}`,
          };
        });

        if (alive) setEvents(ui);
      } catch (err) {
        console.error(err);
        if (alive) setError("Failed to load events");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      ac.abort();
    };
  }, []);

  // UI
  if (loading) {
    return (
      <section className="w-full py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-10">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 dark:text-white mb-2 font-geist tracking-[-0.06em]">
              Featured Events
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Loading the nearest events…
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="overflow-hidden bg-white animate-pulse">
                <div className="w-full h-56 bg-gray-200 dark:bg-gray-700" />
                <CardHeader className="pb-3">
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2 mb-4">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                  <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full py-12">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-10">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 dark:text-white mb-2 font-geist tracking-[-0.06em]">
            Featured Events
          </h2>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">
              {error}
            </p>
          )}
        </div>

        {events.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-600 dark:text-gray-300">
              No events yet. Check back soon!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {events.map((e) => (
              <Link key={e.id} href={e.href} className="group block">
                <Card className="overflow-hidden rounded-2xl bg-white border-0 shadow-sm ring-1 ring-black/5 transition-all duration-300 group-hover:shadow-lg group-hover:-translate-y-0.5">
                  <div className="relative">
                    <Image
                      src={e.image}
                      alt={e.title}
                      width={1200}
                      height={630}
                      className="h-56 w-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (target.src !== "/img/placeholder.png") {
                          target.src = "/img/placeholder.png";
                        }
                      }}
                    />
                    {(() => {
                      const { dow, day, monYear } = getDateParts(e.dateISO);
                      return (
                        <div className="absolute right-4 top-4 rounded-2xl bg-white text-gray-900 shadow-md px-3 py-2 grid place-items-center leading-tight">
                          <div className="text-xs font-medium">
                            {dow || "TBD"}
                          </div>
                          <div className="text-3xl font-bold -my-1">
                            {day || "--"}
                          </div>
                          <div className="text-[11px]">{monYear || ""}</div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex flex-wrap gap-2 px-5 pt-4">
                    {[e.category].filter(Boolean).map((t) => (
                      <Badge
                        key={t}
                        variant="secondary"
                        className="rounded-full bg-gray-100 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200"
                      >
                        {t}
                      </Badge>
                    ))}
                  </div>

                  <div className="px-5 pb-5 pt-3">
                    <h3 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white font-geist tracking-[-0.06em]">
                      {e.title}
                    </h3>
                    <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {e.location}
                    </div>
                    <p className="mt-3 text-gray-600 dark:text-gray-300 line-clamp-2">
                      {e.description}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}

        <div className="text-center">
          <Button size="default" variant="defaultGray" asChild>
            <Link href="/events">View all</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
