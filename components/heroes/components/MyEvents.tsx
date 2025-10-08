import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/app/utils/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getRoleLabel } from "@/features/user/roles/roles";

type APIEvent = {
    event_id?: string | number;
    id?: string | number;
    event_name?: string | null;
    event_date?: string | null;
    location?: string | null;
    cover_image_url?: string | null;
    slug?: string | null;
    role_labels?: Record<string, string> | null;
    user_event_roles?: { role: number }[];
};

type UIEvent = {
    id: string;
    title: string;
    dateISO: string | null;
    location: string;
    image: string;
    href: string;
    roleLabel?: string;
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

export function MyEvents() {
    const [events, setEvents] = useState<UIEvent[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const supabase = createClient();

        const fetchMyEvents = async () => {
        setLoading(true);
        setError(null);
        try {
            const {
            data: { session },
            } = await supabase.auth.getSession();
            const uid = session?.user?.id;
            if (!uid) {
            setEvents([]);
            setLoading(false);
            return;
            }

            const res = await fetch(`/api/users/${uid}/profile`, {
            credentials: "include",
            headers: { "cache-control": "no-store" },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const payload = await res.json();
            const rawEvents: APIEvent[] = payload.events || [];

            const uiEvents: UIEvent[] = rawEvents.map((e) => {
            const id = String(e.event_id ?? e.id ?? "");
            const dateISO = e.event_date ?? null;
            const roleLabel = e.user_event_roles?.[0]?.role
                ? getRoleLabel(String(e.user_event_roles[0].role), e.role_labels)
                : undefined;
            return {
                id,
                title: e.event_name ?? "Untitled Event",
                dateISO,
                location: e.location ?? "Online",
                image: e.cover_image_url ?? "/img/placeholder.png",
                href: e.slug ? `/events/${e.slug}` : `/events/${id}`,
                roleLabel,
            };
            });

            setEvents(uiEvents);
        } catch (err) {
            setError("Failed to load your events");
            setEvents([]);
        } finally {
            setLoading(false);
        }
        };

        fetchMyEvents();
    }, []);

    return (
        <section className="w-full">
        <h2 className="text-2xl font-semibold mb-3">My events</h2>
        {loading ? (
            <div className="text-gray-500">Loading your events…</div>
        ) : error ? (
            <div className="text-red-600">{error}</div>
        ) : events.length === 0 ? (
            <div className="text-gray-500">
            You are not registered for any events yet.
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((e) => (
                <Link key={e.id} href={e.href} className="group block">
                <Card className="overflow-hidden rounded-2xl bg-white border-0 shadow-sm ring-1 ring-black/5 transition-all duration-300 group-hover:shadow-lg group-hover:-translate-y-0.5">
                    <div className="relative">
                    <img
                        src={e.image}
                        alt={e.title}
                        width={1200}
                        height={630}
                        className="h-48 w-full object-cover"
                        onError={(ev) => {
                        const target = ev.currentTarget as HTMLImageElement;
                        if (target.src !== "/img/placeholder.png")
                            target.src = "/img/placeholder.png";
                        }}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                    />
                    {(() => {
                        const { dow, day, monYear } = getDateParts(
                        e.dateISO ?? undefined
                        );
                        return (
                        <div className="absolute right-4 top-4 rounded-2xl bg-white text-gray-900 shadow-md px-3 py-2 grid place-items-center leading-tight">
                            <div className="text-xs font-medium">
                            {dow || "TBD"}
                            </div>
                            <div className="text-2xl font-bold -my-1">
                            {day || "--"}
                            </div>
                            <div className="text-[11px]">{monYear || ""}</div>
                        </div>
                        );
                    })()}
                    </div>

                    <CardHeader className="pb-0 pt-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-base md:text-lg font-semibold tracking-tight text-gray-900">
                        {e.title}
                        </h3>
                        {e.roleLabel && (
                        <Badge
                            variant="secondary"
                            className="rounded-full bg-gray-100 text-gray-700"
                        >
                            {e.roleLabel}
                        </Badge>
                        )}
                    </div>
                    </CardHeader>
                    <CardContent className="pt-2 pb-5">
                    <div className="text-sm text-gray-500">{e.location}</div>
                    </CardContent>
                </Card>
                </Link>
            ))}
            </div>
        )}
        </section>
    );
}
