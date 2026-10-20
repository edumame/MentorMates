"use client";

import { EventCard } from "@/components/events/event-card";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { EventRole, EventVisibility } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { getRoleLabel } from "@/features/user/roles/roles";
import { useAuth } from "@/features/user/authentication/auth/AuthContext";

interface Event {
  event_id: string;
  slug?: string;
  event_name: string;
  event_date: string;
  location: string;
  cover_image_url?: string;
  bucket_id?: string;
  event_buckets?: {
    bucket_id: string;
    bucket_name: string;
    bucket_slug: string;
    bucket_color: string;
    bucket_icon?: string;
  };
  role_labels?: Record<string, string>;
  visibility?: EventVisibility;
  event_blurb?: string;
  event_description?: string;
  external_url?: string | null;
  external_redirect_enabled?: boolean | null;
  paid?: boolean;
  stripe_price_id?: string;
  event_type?: string[];
  userRole?: EventRole | null;
  canManageEvent?: boolean | null;
}

interface UserEventRole {
  event_id: string;
  role: EventRole;
}

export interface EventsListProps {
  events: Event[];
}

export function EventsList({ events }: EventsListProps) {
  const [userEventRoles, setUserEventRoles] = useState<UserEventRole[]>([]);
  const { session } = useAuth();

  useEffect(() => {
    async function fetchUserEventRoles() {
      try {
        if (!session) return;

        const userId = session.user.id;

        const { data, error } = await supabase
          .from("user_event_roles")
          .select("event_id, role")
          .eq("user_id", userId);

        if (error) {
          console.error("Error fetching user event roles:", error);
          return;
        }

        if (data) {
          setUserEventRoles(data as UserEventRole[]);
        }
      } catch (error) {
        console.error("Error fetching user event roles:", error);
      }
    }

    fetchUserEventRoles();
  }, [session]);

  const getUserRoleForEvent = (eventId: string): EventRole | null => {
    const userEventRole = userEventRoles.find(
      (role) => role.event_id === eventId
    );
    return userEventRole ? userEventRole.role : null;
  };

  const getRoleBadgeVariant = (role: EventRole): EventRole => {
    switch (role) {
      case EventRole.Admin:
        return EventRole.Admin;
      case EventRole.Organizer:
        return EventRole.Organizer;
      case EventRole.Judge:
        return EventRole.Judge;
      case EventRole.Mentor:
        return EventRole.Mentor;
      case EventRole.Participant:
        return EventRole.Participant;
      default:
        return EventRole.Participant;
    }
  };

  return (
    <div className="grid min-w-0 max-w-full grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:auto-rows-fr">
      {events.map((event) => {
        const userRole = getUserRoleForEvent(event.event_id);

        return (
          <div
            key={event.event_id}
            className="relative min-w-0 w-full max-w-full"
          >
            <EventCard event={{ ...event, userRole }} />
                  {event.event_buckets && (
                    <Badge 
                      variant="outline" 
                      className="text-xs sm:text-sm border-2"
                      style={{ 
                        borderColor: event.event_buckets.bucket_color,
                        color: event.event_buckets.bucket_color
                      }}
                    >
                      {event.event_buckets.bucket_icon && (
                        <span className="mr-1">{event.event_buckets.bucket_icon}</span>
                      )}
                      {event.event_buckets.bucket_name}
                    </Badge>
                  )}
            {/* User Role Badge Overlay */}
            {userRole && (
              <div className="absolute top-3 left-3 z-10">
                <Badge
                  variant={getRoleBadgeVariant(userRole)}
                  className="capitalize text-xs shadow-md"
                >
                  {getRoleLabel(userRole, event.role_labels)}
                </Badge>
              </div>
            )}
            {/* Archived Badge */}
            {event.visibility === EventVisibility.Archived && (
              <div className="absolute top-3 right-3 z-10">
                <Badge
                  variant="secondary"
                  className="bg-orange-100 text-orange-800 text-xs shadow-md"
                >
                  📁 Archived
                </Badge>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
