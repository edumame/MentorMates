import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { notFound } from "next/navigation";
import { JoinEventButton } from "@/components/events/join-event-button";
import { EventStatusBar } from "@/components/events/event-status-bar";
import ReactMarkdown from "react-markdown";
import {
  EventDetails,
  ScheduleDay,
  ScheduleEvent,
  Resource,
  EventTrack,
} from "@/lib/types";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { isValidUUID } from "@/app/utils/supabase/queries";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EventOverviewPage({ params }: PageProps) {
  const { id } = await Promise.resolve(params);
  const supabase = await createSupabaseClient();

  const isUUID = isValidUUID(id);

  let query = supabase.from("events").select(`
    event_id, 
    event_name, 
    event_description, 
    event_blurb, 
    event_date, 
    location, 
    rules, 
    event_schedule, 
    event_prizes, 
    event_resources,
    paywall_content
  `);

  if (isUUID) {
    // If it's a UUID, check both slug and event_id
    query = query.or(`slug.eq.${id},event_id.eq.${id}`);
  } else {
    // If it's not a UUID, only check slug
    query = query.eq("slug", id);
  }

  const { data: eventData, error: eventError } = await query.single();

  if (eventError || !eventData) {
    notFound();
  }

  const { data: tracksData } = await supabase
    .from("event_tracks")
    .select(
      `
      *,
      prizes (
        prize_amount,
        prize_description
      )
    `
    )
    .eq("event_id", eventData.event_id);

  const typedEvent = eventData as EventDetails;
  const tracks = (tracksData || []) as EventTrack[];

  // Check if user has joined and get their role
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let hasJoined = false;
  let isParticipant = false;

  if (user) {
    const { data: userEventRole } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("event_id", eventData.event_id)
      .maybeSingle();

    hasJoined = !!userEventRole;
    isParticipant = userEventRole?.role === "participant";
  }

  return (
    <div className="container mx-auto py-4">
      {/* Status Bar */}
      <EventStatusBar eventId={eventData.event_id} />

      {/* Join Button */}
      {!hasJoined && (
        <div className="flex justify-center mb-8">
          <JoinEventButton
            eventId={eventData.event_id}
            eventName={typedEvent.event_name}
          />
        </div>
      )}

      {/* Event Details */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{typedEvent.event_name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-blue max-w-none">
            <ReactMarkdown>{typedEvent.event_description}</ReactMarkdown>
          </div>
        </CardContent>
      </Card>

      {/* Paywall Content - Only shown to participants */}
      {isParticipant && typedEvent.paywall_content && (
        <Card className="mb-8 border-2 border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-yellow-800">
              🔒 Exclusive Content for Participants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-blue max-w-none">
              <ReactMarkdown>{typedEvent.paywall_content}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rules */}
      {typedEvent.rules && typedEvent.rules.length > 0 && (
        <Card className="shadow-lg rounded-lg mb-8">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-semibold text-gray-800">
              Rules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {typedEvent.rules.map((rule, idx) => (
                <div key={idx}>
                  <h3 className="font-bold text-lg mb-2 text-blue-800">
                    {rule.title}
                  </h3>
                  <ul className="list-disc pl-5 space-y-1 text-gray-600">
                    {rule.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule */}
      {typedEvent.event_schedule?.length > 0 && (
        <Card className="shadow-lg rounded-lg mb-8">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-semibold text-gray-800">
              Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {typedEvent.event_schedule.map((day: ScheduleDay, idx) => (
                <div key={idx}>
                  <h3 className="font-bold text-xl mb-3 text-blue-800">
                    {day.time}
                  </h3>
                  <div className="space-y-2">
                    {day.events.map((event: ScheduleEvent, eIdx: number) => (
                      <div
                        key={eIdx}
                        className="border-b pb-3 last:border-0 last:pb-0"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-gray-800">
                            {event.name}
                          </span>
                          <span className="text-gray-500 whitespace-nowrap">
                            {event.time}
                          </span>
                        </div>
                        {event.description && (
                          <div className="prose prose-sm prose-blue max-w-none text-gray-600 mt-2">
                            <ReactMarkdown>{event.description}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tracks */}
      {tracks.length > 0 && (
        <Card className="shadow-lg rounded-lg mb-8">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-semibold text-gray-800">
              Prizes & Tracks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {tracks.map((track) => (
                <Card key={track.track_id} className="shadow border rounded-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xl font-bold text-blue-900">
                      {track.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {track.prizes && track.prizes.length > 0 && (
                      <div className="space-y-4">
                        {track.prizes.map((prize, index) => (
                          <div
                            key={index}
                            className="border-b pb-3 last:border-b-0 last:pb-0"
                          >
                            <div className="text-2xl font-extrabold text-green-600 mb-2">
                              {prize.prize_amount}
                            </div>
                            <p className="text-gray-600">
                              {prize.prize_description}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resources */}
      {typedEvent.event_resources?.length > 0 && (
        <Card className="shadow-lg rounded-lg mb-8">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-semibold text-gray-800">
              Important Links
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {typedEvent.event_resources.map((res: Resource, idx) => (
                <a
                  key={idx}
                  href={res.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center p-4 bg-blue-50 hover:bg-blue-200 transition-colors rounded-lg shadow-sm"
                >
                  <span className="text-sm font-medium text-gray-800">
                    {res.name}
                  </span>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* FAQ */}
      {typedEvent.faq && (
        <Card className="shadow-lg rounded-lg mb-8">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-semibold text-gray-800">
              Frequently Asked Questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-blue max-w-none">
              <ReactMarkdown>{typedEvent.faq}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
