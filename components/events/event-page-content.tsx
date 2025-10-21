"use client";

import ReactMarkdown from "react-markdown";
import { customMarkdownComponents } from "@/components/markdown/custom-components";
import { markdownRehypePlugins } from "@/components/markdown/plugins";
import {
  EventDetails,
  ScheduleDay,
  ScheduleEvent,
  EventTrack,
  EventRole,
} from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MentorDashboard } from "@/features/user/dashboards/dashboard/mentor-dashboard";
import { ParticipantDashboard } from "@/features/user/dashboards/dashboard/participant-dashboard";
import { JudgeDashboard } from "@/features/user/dashboards/dashboard/judge-dashboard";
import { useActiveRole } from "./ActiveRoleContext";

interface EventPageContentProps {
  event: EventDetails;
  tracks: EventTrack[];
  hasJoined: boolean;
  userRole?: EventRole | null;
}

export function EventPageContent({
  event,
  tracks,
  hasJoined,
  userRole,
}: EventPageContentProps) {
  // Get active role from context, fallback to userRole
  const { activeRole } = useActiveRole();
  const displayRole = activeRole || userRole;

  // Show participant-style dashboard for mentors (no project creation)
  if (displayRole === "mentor") {
    return (
      <div className="flex flex-col flex-1 w-full">
        <ParticipantDashboard eventId={event.event_id} canCreateProjects={false} />
      </div>
    );
  }

  if (displayRole === "judge") {
    return (
      <div className="flex flex-col flex-1 w-full">
        <JudgeDashboard eventId={event.event_id} />
      </div>
    );
  }

  // Show default event overview for participants, organizers, and non-authenticated users
  return (
    <div className="flex flex-col flex-1">
      {/* Introduction */}
      <div className="flex flex-col pb-4 pt-0 px-0 w-full">
        <h2 className="font-semibold text-[24px] leading-[32px] text-black tracking-[-0.6px]">
          Introduction
        </h2>
      </div>

      {/* Event Description */}
      <div className="flex flex-col pb-4 pt-0 px-0 w-full">
        <div className="prose prose-blue max-w-none">
          <ReactMarkdown
            rehypePlugins={markdownRehypePlugins}
            components={customMarkdownComponents}
          >
            {event.event_description}
          </ReactMarkdown>
        </div>
      </div>

      {/* Paywall Content */}
      {hasJoined && event.paywall_content && (
        <div className="mb-8 border-2 border-yellow-200 bg-yellow-50 rounded-lg p-6">
          <h3 className="text-yellow-800 font-semibold text-xl mb-4">
            🔒 Exclusive Content for People In the Event
          </h3>
          <div className="prose prose-blue max-w-none">
            <ReactMarkdown>{event.paywall_content}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* Rules */}
      {event.rules && event.rules.length > 0 && (
        <>
          <div className="flex flex-col pb-4 pt-0 px-0 w-full">
            <h2 className="font-semibold text-[24px] leading-[32px] text-black tracking-[-0.6px]">
              Rules
            </h2>
          </div>

          {event.rules.map((rule, idx) => (
            <div key={idx} className="flex flex-col pb-4 pt-0 px-0 w-full">
              <div className="font-normal text-black">
                <p className="font-medium text-base leading-[1.5] mb-0">
                  {rule.title}
                </p>
                <ul className="list-disc pl-6">
                  {rule.items.map((item, i) => (
                    <li key={i} className="mb-0 text-base leading-[1.5]">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Schedule */}
      {event.event_schedule?.length > 0 && (
        <>
          <div className="flex flex-col pb-4 pt-5 px-0 w-full">
            <h2 className="font-semibold text-[28px] leading-[1.4] text-black tracking-[-0.06em]">
              Project Presentations
            </h2>
          </div>

          {event.event_schedule.map((day: ScheduleDay, idx) => (
            <div key={idx} className="flex flex-col pb-4 pt-0 px-0 w-full">
              <div className="font-normal text-black">
                <p className="font-medium text-base leading-[1.5] mb-0">
                  {day.time}
                </p>
                <ul className="list-disc pl-6">
                  {day.events.map((event: ScheduleEvent, eIdx: number) => (
                    <li key={eIdx} className="mb-0 text-base leading-[1.5]">
                      <div className="flex justify-between items-start">
                        <span>{event.name}</span>
                        <span className="text-gray-500">{event.time}</span>
                      </div>
                      {event.description && (
                        <div className="prose prose-sm prose-blue max-w-none text-gray-600 mt-2">
                          <ReactMarkdown
                            rehypePlugins={markdownRehypePlugins}
                            components={customMarkdownComponents}
                          >
                            {event.description}
                          </ReactMarkdown>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </>
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

      {/* FAQ */}
      {event.faq && (
        <>
          <div className="flex flex-col pb-4 pt-5 px-0 w-full">
            <h2 className="font-semibold text-[22px] leading-[1.4] text-black tracking-[-0.06em]">
              Award Ceremony
            </h2>
          </div>
          <div className="flex flex-col pb-4 pt-0 px-0 w-full">
            <div className="prose prose-blue max-w-none">
              <ReactMarkdown
                rehypePlugins={markdownRehypePlugins}
                components={customMarkdownComponents}
              >
                {event.faq}
              </ReactMarkdown>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
