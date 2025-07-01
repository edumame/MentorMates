"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { EventItem, EventRole, EventVisibility } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArchiveEventButton } from "./archive-event-button";
import { Archive, Calendar, MapPin } from "lucide-react";

interface EventWithRole extends EventItem {
  userRole: EventRole | null;
}

interface ArchivedEventsClientProps {
  eventsList: EventWithRole[];
}

export function ArchivedEventsClient({ eventsList }: ArchivedEventsClientProps) {
  const [events, setEvents] = useState<EventWithRole[]>(eventsList);

  const handleArchiveStatusChange = (eventId: string, newVisibility: EventVisibility) => {
    setEvents(prevEvents => 
      prevEvents.filter(event => 
        // Remove from archived list if unarchived
        !(event.event_id === eventId && newVisibility !== EventVisibility.Archived)
      )
    );
  };

  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <Archive className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Archived Events</h3>
        <p className="text-gray-600">
          You don't have any archived events yet. Events you archive will appear here.
        </p>
        <div className="mt-6">
          <Link
            href="/events"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            View Active Events
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {events.length} archived event{events.length !== 1 ? 's' : ''}
        </p>
        <Link
          href="/events"
          className="text-sm font-medium text-blue-600 hover:text-blue-500"
        >
          ← Back to Active Events
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <Card key={event.event_id} className="overflow-hidden border-orange-200 bg-orange-50/30">
            <div className="relative">
              {event.cover_image_url && (
                <div className="aspect-video w-full overflow-hidden">
                  <Image
                    src={event.cover_image_url}
                    alt={event.event_name}
                    width={400}
                    height={225}
                    className="h-full w-full object-cover opacity-75"
                  />
                </div>
              )}
              <div className="absolute top-2 right-2">
                <div className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold bg-orange-100 text-orange-800 border-orange-200">
                  <Archive className="h-3 w-3 mr-1" />
                  Archived
                </div>
              </div>
            </div>

            <CardHeader className="pb-3">
              <CardTitle className="line-clamp-2">
                <Link 
                  href={`/events/${event.event_id}/overview`}
                  className="hover:text-blue-600 transition-colors"
                >
                  {event.event_name}
                </Link>
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span>Date: {event.event_date}</span>
                </div>
                {event.location && (
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="line-clamp-1">Location: {event.location}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                {event.userRole && (
                  <div className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold text-foreground">
                    {event.userRole}
                  </div>
                )}
                
                {(event.userRole === "organizer" || event.userRole === "admin") && (
                  <ArchiveEventButton
                    eventId={event.event_id}
                    eventName={event.event_name}
                    currentVisibility={EventVisibility.Archived}
                    onArchiveStatusChange={(newVisibility) => 
                      handleArchiveStatusChange(event.event_id, newVisibility)
                    }
                    variant="ghost"
                    size="sm"
                  />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}