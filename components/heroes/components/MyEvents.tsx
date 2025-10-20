import { useEffect, useState } from "react";
import { createClient } from "@/app/utils/supabase/client";
import { Badge } from "@/components/ui/badge";
import { getRoleLabel } from "@/features/user/roles/roles";
import { EventCard } from "@/components/events/event-card";
import { EventItem, EventVisibility } from "@/lib/types";

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
  visibility?: EventVisibility | null;
};

type UIEvent = {
  id: string;
  title: string;
  dateISO: string | null;
  location: string;
  image: string;
  href: string;
  slug?: string;
  roleLabel?: string;
  visibility?: EventVisibility;
};

function toEventItem(event: UIEvent): EventItem {
  return {
    event_id: event.id,
    // Prefer linking by id; slug is optional and can be omitted
    event_name: event.title,
    event_date: event.dateISO ?? "",
    location: event.location,
    cover_image_url: event.image,
    slug: event.slug,
  };
}

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
            slug: e.slug ?? undefined,
            roleLabel,
            visibility: e.visibility as EventVisibility,
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
            <div key={e.id} className="relative">
              <EventCard event={toEventItem(e)} />
              {e.roleLabel && (
                <div className="absolute top-3 left-3 z-10">
                  <Badge
                    variant="secondary"
                    className="rounded-full bg-gray-100 text-gray-700 mr-2"
                  >
                    {e.roleLabel}
                  </Badge>

                  {e.visibility === EventVisibility.Draft && (
                    <Badge
                      variant="secondary"
                      className="rounded-full bg-yellow-300 text-gray-700 hover:bg-yellow-200"
                    >
                      Draft
                    </Badge>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
