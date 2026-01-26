"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import ProjectBoard from "@/features/projects/components/displays/ProjectBoard/ProjectBoard";
import { DiscordCTA } from "@/components/ui/discord-cta";
import { Footer } from "@/components/layout/Footer";
import { PageContainer, PageContent } from "@/components/layout/PageContainer";
import { Project, ProjectBoardContext } from "@/lib/types";

const DEFAULT_PUBLIC_EVENT_SLUG = "mentormateshackathon";

type PublicEventOption = {
  event_id: string;
  event_name: string;
  slug: string | null;
};

export function PublicProjectsGallery() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [publicEvents, setPublicEvents] = useState<PublicEventOption[]>([]);
  const [isPublicEventsLoading, setIsPublicEventsLoading] = useState(false);

  const [selectedEventSlug, setSelectedEventSlug] = useState<string>(
    searchParams.get("event") ??
      searchParams.get("eventSlug") ??
      DEFAULT_PUBLIC_EVENT_SLUG
  );
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const [publicProjects, setPublicProjects] = useState<Project[]>([]);
  const [isPublicProjectsLoading, setIsPublicProjectsLoading] = useState(false);
  const [publicProjectsError, setPublicProjectsError] = useState<string | null>(
    null
  );

  // Load events for selector.
  useEffect(() => {
    const loadEvents = async () => {
      setIsPublicEventsLoading(true);
      try {
        const response = await fetch("/api/events");
        if (!response.ok) return;

        const data = (await response.json()) as { events?: PublicEventOption[] };
        const events = (data.events || []).filter((e) => Boolean(e.slug));
        setPublicEvents(events);

        if (events.length === 0) return;

        const current = selectedEventSlug?.trim();
        const currentMatch = current
          ? events.find((e) => e.slug === current)
          : null;

        if (currentMatch) {
          setSelectedEventId(currentMatch.event_id);
          return;
        }

        // Prefer MentorMates Hackathon if available; otherwise fall back to first visible event.
        const preferred =
          events.find((e) => e.slug === DEFAULT_PUBLIC_EVENT_SLUG) ?? events[0];

        if (preferred?.slug) {
          setSelectedEventSlug(preferred.slug);
          setSelectedEventId(preferred.event_id);
          router.replace(`/projects?event=${encodeURIComponent(preferred.slug)}`);
        }
      } catch {
        // Non-blocking
      } finally {
        setIsPublicEventsLoading(false);
      }
    };

    void loadEvents();
    // Intentionally only on mount; URL changes are handled by select changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch public projects. Prefer eventId once it’s known.
  useEffect(() => {
    const loadPublicProjects = async () => {
      if (
        isPublicEventsLoading ||
        (publicEvents.length > 0 &&
          selectedEventId === null &&
          !publicEvents.some((e) => e.slug === selectedEventSlug))
      ) {
        return;
      }

      setIsPublicProjectsLoading(true);
      setPublicProjectsError(null);
      try {
        const slug = selectedEventSlug?.trim();
        const url = selectedEventId
          ? `/api/projects?public=true&eventId=${encodeURIComponent(
              selectedEventId
            )}`
          : slug
            ? `/api/projects?public=true&eventSlug=${encodeURIComponent(slug)}`
            : null;

        if (!url) {
          setPublicProjects([]);
          setPublicProjectsError("Please select an event to view projects.");
          return;
        }

        const response = await fetch(url);
        if (!response.ok) {
          let message =
            "Couldn’t load projects for this event. It may be private or unavailable.";
          try {
            const body = (await response.json()) as { error?: string };
            if (body?.error) message = body.error;
          } catch {
            // ignore parse issues
          }
          setPublicProjectsError(message);
          setPublicProjects([]);
          return;
        }

        const data = (await response.json()) as { projects?: Project[] };
        setPublicProjects(data.projects || []);
      } catch {
        setPublicProjectsError("Couldn’t load projects right now. Please try again.");
        setPublicProjects([]);
      } finally {
        setIsPublicProjectsLoading(false);
      }
    };

    void loadPublicProjects();
  }, [
    publicEvents,
    isPublicEventsLoading,
    selectedEventId,
    selectedEventSlug,
  ]);

  const selectedIsInList = useMemo(
    () => publicEvents.some((e) => e.slug === selectedEventSlug),
    [publicEvents, selectedEventSlug]
  );

  return (
    <PageContainer showBorder={false}>
      <PageContent className="pt-[24px] pb-8">
        <div className="mx-auto w-full max-w-10xl px-4 md:px-10 lg:px-24 flex flex-col gap-8">
          <div className="flex flex-col items-center text-center gap-3 pt-6">
            <h1 className="text-[28px] sm:text-[36px] font-semibold tracking-[-0.06em] text-black">
              Showcase of Past Innovations
            </h1>
            <p className="text-sm sm:text-base text-black/60 max-w-[520px]">
              Explore diverse projects from talented participants.
            </p>
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <div className="flex items-center bg-white border border-[rgba(0,0,0,0.15)] rounded-xl p-1">
                <select
                  value={selectedEventId ?? selectedEventSlug}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    const match = publicEvents.find(
                      (evt) => evt.event_id === nextId
                    );
                    if (!match?.slug) return;

                    setSelectedEventId(nextId);
                    setSelectedEventSlug(match.slug);
                    router.push(`/projects?event=${encodeURIComponent(match.slug)}`);
                  }}
                  className="h-9 bg-transparent px-3 text-sm font-medium text-black focus:outline-none"
                  aria-label="Select event"
                >
                  {isPublicEventsLoading && publicEvents.length === 0 ? (
                    <option value={selectedEventSlug}>Loading events…</option>
                  ) : publicEvents.length === 0 ? (
                    <option value={selectedEventSlug}>{selectedEventSlug}</option>
                  ) : (
                    <>
                      {!selectedIsInList && (
                        <option value={selectedEventSlug}>{selectedEventSlug}</option>
                      )}
                      {publicEvents.map((evt) => (
                        <option key={evt.event_id} value={evt.event_id}>
                          {evt.event_name}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              <Button asChild variant="outline" className="h-10">
                <Link href="/events">Browse other events</Link>
              </Button>

              <Button asChild className="h-10 bg-[#4b89ef] hover:bg-[#3d75d9]">
                <Link href="/login?returnUrl=/projects">Log in</Link>
              </Button>
            </div>
          </div>

          {publicProjectsError && (
            <div className="mx-auto w-full max-w-[820px] rounded-xl border border-[rgba(0,0,0,0.15)] bg-white px-4 py-3 text-sm text-black/70">
              {publicProjectsError}
            </div>
          )}

          <ProjectBoard
            isLoading={isPublicProjectsLoading}
            projectList={publicProjects}
            projectBoardContext={ProjectBoardContext.EventGallery}
          />

          <div className="mt-12">
            <DiscordCTA variant="default" />
          </div>
        </div>
      </PageContent>
      <Footer />
    </PageContainer>
  );
}

