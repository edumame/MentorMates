"use client";

import type { ComponentProps } from "react";
import ReactMarkdown from "react-markdown";
import { customMarkdownComponents } from "@/components/markdown/custom-components";
import {
  markdownRehypePlugins,
  markdownRemarkPlugins,
} from "@/components/markdown/plugins";
import { normalizeBullets } from "@/lib/markdown/normalize-bullets";
import { Trophy, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  EventDetails,
  Rule,
  ScheduleDay,
  ScheduleEvent,
  EventTrack,
  EventRole,
} from "@/lib/types";
import Link from "next/link";
import { JudgeDashboard } from "@/features/user/dashboards/dashboard/judge-dashboard";
import { useActiveRole } from "./ActiveRoleContext";
import { UserProjectSection } from "./user-project-section";
import { EventMentorshipSection } from "@/features/events/mentor-bookings/EventMentorshipSection";

/** JSONB / API may return a string, single object, or non-array; only arrays are safe to .map */
function normalizeEventRules(rules: unknown): Rule[] {
  if (rules == null) return [];
  if (Array.isArray(rules)) {
    return rules.filter(
      (r): r is Rule =>
        r != null &&
        typeof r === "object" &&
        typeof (r as Rule).title === "string" &&
        Array.isArray((r as Rule).items)
    );
  }
  if (typeof rules === "string") {
    try {
      return normalizeEventRules(JSON.parse(rules) as unknown);
    } catch {
      return [];
    }
  }
  if (typeof rules === "object" && "title" in rules && "items" in rules) {
    const r = rules as Rule;
    if (typeof r.title === "string" && Array.isArray(r.items)) {
      return [r];
    }
  }
  return [];
}

interface EventPageContentProps {
  event: EventDetails;
  tracks: EventTrack[];
  hasJoined: boolean;
  userRole?: EventRole | null;
  userProjects?: ComponentProps<typeof UserProjectSection>["projects"];
  eventSlug?: string | null;
  submissionDeadline?: string | null;
  judges?: {
    id: string;
    name: string;
    bio?: string | null;
    avatarUrl?: string | null;
    affiliation?: string | null;
  }[];
}

export function EventPageContent({
  event,
  tracks,
  hasJoined,
  userRole,
  userProjects = [],
  eventSlug,
  submissionDeadline,
  judges = [],
}: EventPageContentProps) {
  const rulesList = normalizeEventRules(event.rules);

  const getInitials = (name: string) =>
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("");

  const formatPrizeDisplay = (
    prizeAmount: string,
    prizeDescription: string,
  ) => {
    const amount = prizeAmount?.trim() || "";
    const description = prizeDescription?.trim() || "";
    const descriptionLower = description.toLowerCase();
    const amountLower = amount.toLowerCase();

    if (!amount && !description) {
      return { title: "Prize details coming soon", subtitle: "" };
    }

    if (!amount) {
      return { title: description, subtitle: "" };
    }

    if (!description) {
      return { title: amount, subtitle: "" };
    }

    if (descriptionLower.startsWith(amountLower)) {
      const title = description
        .slice(amount.length)
        .trim()
        .replace(/^[\-–:]\s*/, "");
      return {
        title: title || description,
        subtitle: description,
      };
    }

    return {
      title: description,
      subtitle: `${amount} ${description}`.trim(),
    };
  };

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
    <div className="flex min-w-0 flex-1 flex-col w-full max-w-full">
      {hasJoined && displayRole === EventRole.Participant && (
        <UserProjectSection
          projects={userProjects}
          eventId={event.event_id}
          eventSlug={eventSlug}
          submissionDeadline={submissionDeadline}
        />
      )}

      <EventMentorshipSection
        eventId={event.event_id}
        role={displayRole}
        hasJoined={hasJoined}
      />

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
            remarkPlugins={markdownRemarkPlugins}
            rehypePlugins={markdownRehypePlugins}
            components={customMarkdownComponents}
          >
            {normalizeBullets(event.event_description)}
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
            <ReactMarkdown remarkPlugins={markdownRemarkPlugins}>
              {normalizeBullets(event.paywall_content)}
            </ReactMarkdown>
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

      {/* Judges */}
      {judges.length > 0 && (
        <>
          <div className="h-px bg-[rgba(0,0,0,0.15)] w-full my-0" />
          <div className="flex flex-col pt-4 pb-4 px-0 w-full min-w-0 max-w-full">
            <h2 className="font-semibold text-[24px] leading-[32px] text-black tracking-[-0.6px] break-words">
              Judges
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-3 w-full pb-4">
            {judges.map((judge) => {
              const secondaryText = judge.affiliation || judge.bio || "Judge";

              return (
                <div key={judge.id} className="flex items-center gap-3 min-w-0">
                  {judge.avatarUrl ? (
                    <img
                      src={judge.avatarUrl}
                      alt={judge.name}
                      className="h-10 w-10 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-[rgba(0,0,0,0.08)] text-[13px] font-semibold text-[rgba(0,0,0,0.65)] flex items-center justify-center shrink-0">
                      {getInitials(judge.name)}
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="font-semibold text-[16px] leading-[1.5] text-black truncate">
                      {judge.name}
                    </p>
                    <p className="font-normal text-[14px] leading-[1.5] text-black truncate">
                      {secondaryText}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Rules */}
      {rulesList.length > 0 && (
        <>
          <div className="flex flex-col pb-4 pt-0 px-0 w-full min-w-0 max-w-full">
            <h2 className="font-semibold text-[24px] leading-[32px] text-black tracking-[-0.6px] break-words">
              Rules
            </h2>
          </div>

          <div className="flex w-full px-4 py-5 rounded-xl border border-[rgba(0,0,0,0.15)] relative">
            <Accordion type="multiple" className="w-full">
              {rulesList.map((rule, idx) => (
                <AccordionItem
                  key={`${rule.title}-${idx}`}
                  value={`${rule.title}-${idx}`}
                  className="last:border-b-0"
                >
                  <AccordionTrigger className="py-3 text-left text-black hover:no-underline">
                    <span className="font-bold tracking-[-0.04em] text-[20px] leading-[1.4]">
                      {rule.title}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3">
                    <ul className="list-disc pl-6">
                      {(rule.items ?? []).map((item, i) => (
                        <li key={i} className="mb-0 text-base leading-[1.5] text-black">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
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
                            remarkPlugins={markdownRemarkPlugins}
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
        <div className="flex flex-col pt-4 pb-8 w-full">
          <div className="flex flex-col pb-4 pt-0 px-0 w-full min-w-0 max-w-full">
            <h2 className="font-semibold text-[24px] leading-[32px] text-black tracking-[-0.6px] break-words">
              Prizes & Tracks
            </h2>
          </div>

          <div className="flex flex-col gap-3 w-full">
            {tracks.map((track) => (
              <div
                key={track.track_id}
                className="w-full rounded-xl border border-[rgba(0,0,0,0.15)] overflow-hidden"
              >
                <div className="bg-[#F7FAFE] border-b border-[rgba(0,0,0,0.15)] px-6 py-4">
                  <p className="font-semibold text-[22px] leading-[1.4] tracking-[-0.06em] text-black">
                    {track.name}
                  </p>
                </div>

                <div className="bg-white px-4 py-4">
                  {track.prizes && track.prizes.length > 0 ? (
                    <div className="flex flex-col">
                      {track.prizes.map((prize, index) =>
                        (() => {
                          const { title, subtitle } = formatPrizeDisplay(
                            prize.prize_amount,
                            prize.prize_description,
                          );

                          return (
                            <div
                              key={index}
                              className="flex items-center gap-3 py-3 border-b border-[rgba(0,0,0,0.15)] last:border-b-0"
                            >
                              <div className="h-12 w-12 shrink-0 rounded-full bg-[rgba(0,0,0,0.08)] flex items-center justify-center">
                                <Trophy className="h-5 w-5 text-[rgba(0,0,0,0.45)]" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-[18px] leading-[1.5] tracking-[-0.04em] text-black break-words">
                                  {title}
                                </p>
                                {subtitle && (
                                  <p className="font-normal text-base leading-[1.5] text-black break-words">
                                    {subtitle}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })(),
                      )}
                    </div>
                  ) : (
                    <p className="font-normal text-base leading-[1.5] text-black">
                      Prizes will be announced soon.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FAQ */}
      {Array.isArray(event.faq) && event.faq.length > 0 && (
        <>
          <div className="flex flex-col pb-4 pt-5 px-0 w-full max-w-full">
            <h2 className="font-semibold text-[22px] leading-[1.4] text-black tracking-[-0.06em]">
              FAQ
            </h2>
          </div>
          <div className="flex flex-col pb-4 pt-0 px-0 w-full max-w-full space-y-4">
            {event.faq.map(
              (item: { question: string; answer: string }, index: number) => (
                <div key={index}>
                  <p className="font-semibold text-base text-black">
                    {item.question}
                  </p>
                  <p className="mt-1 text-base text-gray-600">{item.answer}</p>
                </div>
              ),
            )}
          </div>
        </>
      )}

      {/* Bottom Submit CTA — mirrors header button so participants don't have to scroll back up */}
      {hasJoined && userRole === EventRole.Participant && (
        <div className="mt-8 flex justify-center border-t pt-8">
          <Button
            asChild
            size="lg"
            className="rounded-full gap-2 px-8"
          >
            <Link href={`/projects/submit?eventId=${event.event_id}`}>
              <Plus className="h-5 w-5" />
              Submit Your Project
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
