"use client";

import React, { useEffect, useState } from "react";
import { Calendar, MapPin, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/app/utils/supabase/client";
import { EventRole, EventVisibility } from "@/lib/types";

type DBEvent = {
    event_id?: string; // some schemas use event_id
    id?: string; // others use id
    title?: string | null;
    description?: string | null;
    event_date?: string | null; // ISO
    location?: string | null;
    attendees_count?: number | null;
    category?: string | null;
    image_url?: string | null;
    visibility?: EventVisibility;
};

type UIEvent = {
    id: string;
    title: string;
    description: string;
    dateISO: string | null;
    dateLabel: string;
    location: string;
    attendees: number;
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

export function Featured() {
    const [events, setEvents] = useState<UIEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;

        (async () => {
        setLoading(true);
        setError(null);

        const supabase = createClient();

        try {
            // auth + admin?
            const {
            data: { user },
            } = await supabase.auth.getUser();

            let isAdmin = false;
            if (user) {
            const { data, error } = await supabase.rpc("is_admin_user", {
                user_id: user.id,
            });
            if (error) throw error;
            isAdmin = Boolean(data);
            }

            // organizer’s draft visibility support
            let organizerEventIds: string[] = [];
            if (user && !isAdmin) {
            const { data: roles, error: rolesErr } = await supabase
                .from("user_event_roles")
                .select("event_id, role")
                .eq("user_id", user.id);
            if (rolesErr) throw rolesErr;
            organizerEventIds =
                (roles || [])
                .filter((r) => r.role === EventRole.Organizer)
                .map((r) => String(r.event_id)) ?? [];
            }

            // fetch public/private (or all if admin)
            const publicPrivatePromise = (() => {
            let q = supabase.from("events").select("*");
            if (!isAdmin) {
                q = q.in("visibility", [
                EventVisibility.Public,
                EventVisibility.Private,
                ]);
            }
            // we’ll sort in JS to do “nearest 3”, so no order/limit here
            return q;
            })();

            // fetch draft events you organize (if any)
            const draftsPromise =
            user && !isAdmin && organizerEventIds.length > 0
                ? supabase
                    .from("events")
                    .select("*")
                    .eq("visibility", EventVisibility.Draft)
                    .in("event_id", organizerEventIds)
                : Promise.resolve({ data: [] as DBEvent[], error: null });

            const [
            { data: pubPriv = [], error: ppErr },
            { data: drafts = [], error: drErr },
            ]: any = await Promise.all([publicPrivatePromise, draftsPromise]);

            if (ppErr) throw ppErr;
            if (drErr) throw drErr;

            // merge + de-dupe by id
            const merged = [...(pubPriv as DBEvent[]), ...(drafts as DBEvent[])];
            const byId = new Map<string, DBEvent>();
            for (const e of merged) {
            const id = String(e.event_id ?? e.id ?? "");
            if (id) byId.set(id, e);
            }
            const unique = Array.from(byId.values());

            // split upcoming vs past relative to now
            const now = Date.now();
            const upcoming = unique
            .filter(
                (e) =>
                e.event_date &&
                !Number.isNaN(Date.parse(e.event_date!)) &&
                Date.parse(e.event_date!) >= now
            )
            .sort(
                (a, b) => Date.parse(a.event_date!) - Date.parse(b.event_date!)
            );

            const past = unique
            .filter(
                (e) =>
                e.event_date &&
                !Number.isNaN(Date.parse(e.event_date!)) &&
                Date.parse(e.event_date!) < now
            )
            .sort(
                (a, b) => Date.parse(b.event_date!) - Date.parse(a.event_date!)
            ); // most recent first

            const nearest = [...upcoming, ...past].slice(0, 3);

            const ui: UIEvent[] = nearest.map((e) => {
            const id = String(e.event_id ?? e.id ?? crypto.randomUUID());
            const dateISO = e.event_date ?? null;
            return {
                id,
                title: e.title ?? "Untitled Event",
                description: e.description ?? "No description available",
                dateISO,
                dateLabel: fmtDate(dateISO),
                location: e.location ?? "Online",
                attendees: e.attendees_count ?? 0,
                category: e.category ?? "General",
                image: e.image_url ?? "/api/placeholder/640/360",
                href: `/events/${id}`,
            };
            });

            if (alive) setEvents(ui);
        } catch (e) {
            console.error(e);
            if (alive) setError("Failed to load events");
        } finally {
            if (alive) setLoading(false);
        }
        })();

        return () => {
        alive = false;
        };
    }, []);

    // UI

    if (loading) {
        return (
        <section className="w-full py-16 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
            <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-10">
            <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
                Featured Events
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                Loading the nearest events…
                </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
                <Card
                    key={i}
                    className="overflow-hidden bg-white dark:bg-gray-800 animate-pulse"
                >
                    <div className="w-full h-48 bg-gray-200 dark:bg-gray-700" />
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
        <section className="w-full py-16 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-10">
            <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
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
                <Card
                    key={e.id}
                    className="overflow-hidden hover:shadow-lg transition-shadow duration-300 bg-white dark:bg-gray-800"
                >
                    <div className="relative">
                    <img
                        src={e.image}
                        alt={e.title}
                        className="w-full h-48 object-cover"
                    />
                    <Badge
                        variant="secondary"
                        className="absolute top-3 left-3 bg-white/90 text-gray-800"
                    >
                        {e.category}
                    </Badge>
                    </div>
                    <CardHeader className="pb-3">
                    <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                        {e.title}
                    </CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-300 line-clamp-2">
                        {e.description}
                    </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                    <div className="space-y-2 mb-4">
                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <Calendar className="w-4 h-4 mr-2" />
                        {e.dateLabel}
                        </div>
                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <MapPin className="w-4 h-4 mr-2" />
                        {e.location}
                        </div>
                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <Users className="w-4 h-4 mr-2" />
                        {e.attendees} attendees
                        </div>
                    </div>
                    <Button variant="outline" className="w-full" asChild>
                        <a href={e.href}>View Event</a>
                    </Button>
                    </CardContent>
                </Card>
                ))}
            </div>
            )}

            <div className="text-center">
            <Button
                size="default"
                className="px-4 bg-gray-100 text-gray-900 hover:bg-gray-200 shadow-md"
                asChild
            >
                <a href="/events">View all</a>
            </Button>
            </div>
        </div>
        </section>
    );
}