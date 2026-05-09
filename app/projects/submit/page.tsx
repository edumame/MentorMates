"use client";

import { NewProjectSubmissionFormSinglePage } from "@/features/projects/components/forms/NewProjectSubmissionFormSinglePage";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isValidUUID } from "@/app/utils/supabase/queries";
import { Button } from "@/components/ui/button";
import { PageContainer, PageContent } from "@/components/layout/PageContainer";
import { Toaster } from "@/components/ui/toaster";
import { Loader2 } from "lucide-react";

type ActiveParticipantEvent = {
  event_id: string;
  slug: string | null;
  event_name: string | null;
  event_date: string | null;
  location: string | null;
  cover_image_url: string | null;
};

export default function SubmitProjectPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const eventSlugOrId = searchParams.get("eventId");

  const [eventId, setEventId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [contextusId, setContextusId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeEvents, setActiveEvents] = useState<ActiveParticipantEvent[]>(
    []
  );
  const [activeEventsResolved, setActiveEventsResolved] = useState(false);

  // Resolve event ID from slug or UUID
  useEffect(() => {
    const resolveEventId = async () => {
      if (!eventSlugOrId) {
        return;
      }

      const isUUID = isValidUUID(eventSlugOrId);
      let query = supabase.from("events").select("event_id");

      if (isUUID) {
        query = query.or(`slug.eq.${eventSlugOrId},event_id.eq.${eventSlugOrId}`);
      } else {
        query = query.eq("slug", eventSlugOrId);
      }

      const { data } = await query.maybeSingle();
      if (data) setEventId(data.event_id);
    };
    resolveEventId();
  }, [eventSlugOrId]);

  // When entered without an event context, look for active event registrations
  // and redirect or show a picker so participants don't create orphan projects.
  useEffect(() => {
    if (eventSlugOrId) {
      setIsLoading(false);
      setActiveEventsResolved(true);
      return;
    }

    let cancelled = false;
    const findActiveEvents = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user?.id) {
          if (cancelled) return;
          setActiveEventsResolved(true);
          setIsLoading(false);
          return;
        }

        const { data: roleRows } = await supabase
          .from("user_event_roles")
          .select(
            "event_id, events!inner(event_id, slug, event_name, event_date, location, cover_image_url, submission_time_start, submission_time_cutoff)"
          )
          .eq("user_id", session.user.id)
          .eq("role", "participant");

        if (cancelled) return;

        const now = new Date();
        const candidates: ActiveParticipantEvent[] = [];
        type RoleEventJoin = {
          event_id: string;
          events:
            | {
                event_id: string;
                slug: string | null;
                event_name: string | null;
                event_date: string | null;
                location: string | null;
                cover_image_url: string | null;
                submission_time_start: string | null;
                submission_time_cutoff: string | null;
              }
            | Array<{
                event_id: string;
                slug: string | null;
                event_name: string | null;
                event_date: string | null;
                location: string | null;
                cover_image_url: string | null;
                submission_time_start: string | null;
                submission_time_cutoff: string | null;
              }>
            | null;
        };
        for (const row of ((roleRows || []) as unknown) as RoleEventJoin[]) {
          const ev = Array.isArray(row.events) ? row.events[0] : row.events;
          if (!ev) continue;
          const start = ev.submission_time_start
            ? new Date(ev.submission_time_start)
            : null;
          const cutoff = ev.submission_time_cutoff
            ? new Date(ev.submission_time_cutoff)
            : null;
          if (start && now < start) continue;
          if (cutoff && now > cutoff) continue;
          candidates.push({
            event_id: ev.event_id,
            slug: ev.slug,
            event_name: ev.event_name,
            event_date: ev.event_date,
            location: ev.location,
            cover_image_url: ev.cover_image_url,
          });
        }

        if (candidates.length === 1) {
          const target = candidates[0];
          const param = target.slug || target.event_id;
          router.replace(`/projects/submit?eventId=${encodeURIComponent(param)}`);
          return;
        }

        setActiveEvents(candidates);
        setActiveEventsResolved(true);
        setIsLoading(false);
      } catch {
        if (cancelled) return;
        setActiveEventsResolved(true);
        setIsLoading(false);
      }
    };

    findActiveEvents();
    return () => {
      cancelled = true;
    };
  }, [eventSlugOrId, router]);

  // Get current user info
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        setUserEmail(session.user.email || null);
        setUserName(
          session.user.user_metadata?.full_name ||
            session.user.user_metadata?.name ||
            null
        );

        const { data: profile } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("uid", session.user.id)
          .single();

        if (profile) {
          setUserName(
            profile.display_name ||
              session.user.user_metadata?.full_name ||
              null
          );
        }
      }
    };
    getUser();
  }, []);

  // Fetch the user's latest draft for this event and show Contextus ID
  useEffect(() => {
    const fetchDraft = async () => {
      if (!eventId || !userEmail) return;
      const { data } = await supabase
        .from("projects")
        .select("id, contextus_project_id, lead_email, submitted, created_at")
        .eq("event_id", eventId)
        .eq("lead_email", userEmail)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.contextus_project_id) setContextusId(data.contextus_project_id);
    };
    fetchDraft();
  }, [eventId, userEmail]);

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center flex-grow">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </PageContainer>
    );
  }

  if (!eventSlugOrId && activeEventsResolved && activeEvents.length > 1) {
    return (
      <PageContainer>
        <PageContent className="flex flex-col">
          <div className="mx-auto w-full max-w-2xl py-10">
            <h1 className="text-2xl font-semibold mb-2">
              Which event are you submitting to?
            </h1>
            <p className="text-gray-600 mb-6">
              You&apos;re registered for multiple hackathons with open
              submissions. Pick the one this project is for so it shows up in
              the right gallery.
            </p>
            <div className="grid gap-3">
              {activeEvents.map((ev) => (
                <button
                  key={ev.event_id}
                  type="button"
                  onClick={() => {
                    const param = ev.slug || ev.event_id;
                    router.replace(
                      `/projects/submit?eventId=${encodeURIComponent(param)}`
                    );
                  }}
                  className="text-left rounded-xl border border-gray-200 hover:border-[#4b89ef] hover:bg-blue-50/40 transition p-4 flex items-center gap-4"
                >
                  {ev.cover_image_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={ev.cover_image_url}
                      alt=""
                      className="h-14 w-14 rounded-md object-cover shrink-0"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-md bg-blue-100 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {ev.event_name || "Untitled event"}
                    </div>
                    <div className="text-sm text-gray-500 truncate">
                      {[ev.event_date, ev.location]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-6 text-sm text-gray-500">
              Not submitting to an event?{" "}
              <button
                type="button"
                className="text-[#4b89ef] hover:underline"
                onClick={() => setActiveEvents([])}
              >
                Continue as a personal project →
              </button>
            </div>
          </div>
        </PageContent>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Toaster />
      <PageContent className="flex flex-col">
        {contextusId && (
          <div className="sticky top-0 z-10 mb-4 rounded-md border p-3 bg-blue-50 text-blue-800 flex items-center justify-between mx-auto shrink-0">
            <div>
              <span className="font-semibold">Contextus ID:</span> {contextusId}
            </div>
            <Button
              variant="secondary"
              onClick={() => navigator.clipboard.writeText(contextusId)}
            >
              Copy
            </Button>
          </div>
        )}
        <NewProjectSubmissionFormSinglePage
          userEmail={userEmail || ""}
          leadName={userName || ""}
          eventId={eventId || undefined}
          onContextusLinked={(ctxId) => setContextusId(ctxId)}
          contextusId={contextusId}
        />
      </PageContent>
    </PageContainer>
  );
}
