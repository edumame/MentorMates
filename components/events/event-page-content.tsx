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
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  // Show judge-specific dashboard for judges only
  if (displayRole === "judge") {
    return (
      <div className="flex flex-col flex-1 w-full">
        <JudgeDashboard eventId={event.event_id} />
      </div>
    );
  }

  // Show default event overview for participants, mentors, organizers, and non-authenticated users
  return (
    <div className="flex flex-col flex-1 px-2 md:px-4 w-full">
      {/* Introduction */}
      <div className="flex flex-col pb-4 pt-0 px-0 w-full min-w-0 max-w-full">
        <h2 className="font-semibold text-[24px] leading-[32px] text-black tracking-[-0.6px] break-words">
          Introduction
        </h2>
      </div>

      {/* Event Description */}
      <div className="flex flex-col pb-4 pt-0 px-0 w-full min-w-0 max-w-full">
        <div className="prose prose-blue max-w-full break-words w-full">
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
            🔒 Content for Event Participants
          </h3>
          <div className="prose prose-blue max-w-full w-full break-words">
            <ReactMarkdown>{event.paywall_content}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* Lessons */}
      {hasJoined && (event.event_lessons?.length || 0) > 0 && (
        <div className="mb-8">
          <h3 className="font-semibold text-[24px] leading-[32px] text-black tracking-[-0.6px] mb-4">
            Lessons
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(event.event_lessons || []).map((lesson, idx) => (
              <Link
                key={idx}
                href={lesson.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col hover:shadow-md hover:border-gray-300 transition-all duration-200 group"
              >
                <div className="relative w-full aspect-video bg-black rounded-t-xl overflow-hidden">
                  {lesson.cover_image_url && (
                    <img
                      src={lesson.cover_image_url}
                      alt={lesson.title}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <h4 className="text-base font-semibold mb-1 group-hover:text-blue-600 transition-colors">
                    {lesson.title}
                  </h4>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                    {lesson.description}
                  </p>
                  <div className="mt-auto text-xs text-gray-500 flex items-center gap-1">
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
                    {lesson.duration_minutes} min
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Rules */}
      {event.rules && event.rules.length > 0 && (
        <>
          <div className="flex flex-col pb-4 pt-0 px-0 w-full min-w-0 max-w-full">
            <h2 className="font-semibold text-[24px] leading-[32px] text-black tracking-[-0.6px] break-words">
              Rules
            </h2>
          </div>

          <div className="flex w-full  px-4 py-5 rounded-xl border border-[rgba(0,0,0,0.15)] relative">
            <div className="flex flex-wrap sm:flex-nowrap relative w-full">
              {event.rules.map((rule, idx) => (
                <div key={idx} className="flex flex-grow flex-col first:pb-8 sm:pb-0 pt-0 px-0 w-full sm:first:pr-6 sm:last:pl-6 sm:last:border-l sm:border-[rgba(0,0,0,0.15)]">
                  <div className="font-normal text-black">
                    <p className="font-bold tracking-[-0.06em] text-[22px] leading-[1.4] mb-2">
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
            </div>
          </div>
        </>
      )}

      {/* Schedule */}
      {event.event_schedule?.length > 0 && (
        <>
          <div className="flex flex-col pb-4 pt-5 px-0 w-full min-w-0 max-w-full">
            <h2 className="font-semibold text-[28px] leading-[1.4] text-black tracking-[-0.06em] break-words">
              Project Presentations
            </h2>
          </div>

          {event.event_schedule.map((day: ScheduleDay, idx) => (
            <div
              key={idx}
              className="flex flex-col pb-4 pt-0 px-0 w-full min-w-0 max-w-full"
            >
              <div className="font-normal text-black">
                <p className="font-medium text-base leading-[1.5] mb-0 break-words">
                  {day.time}
                </p>
                <ul className="list-disc pl-6">
                  {day.events.map((event: ScheduleEvent, eIdx: number) => (
                    <li
                      key={eIdx}
                      className="mb-0 text-base leading-[1.5] break-words"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="break-words flex-1 min-w-0">
                          {event.name}
                        </span>
                        <span className="text-gray-500 flex-shrink-0">
                          {event.time}
                        </span>
                      </div>
                      {event.description && (
                        <div className="prose prose-sm prose-blue max-w-full w-full text-gray-600 mt-2 break-words">
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
        <Card className="shadow-lg rounded-lg mt-6 mb-8">
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
          <div className="flex flex-col pb-4 pt-5 px-0 w-full max-w-full">
            <h2 className="font-semibold text-[22px] leading-[1.4] text-black tracking-[-0.06em]">
              Award Ceremony
            </h2>
          </div>
          <div className="flex flex-col pb-4 pt-0 px-0 w-full max-w-full">
            <div className="prose prose-blue max-w-full w-full break-words">
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
