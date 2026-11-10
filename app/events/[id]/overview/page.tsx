import React from "react";
import { notFound } from "next/navigation";
import { EventDetails, EventTrack, EventRole, Lesson } from "@/lib/types";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { getEventForRoute } from "@/lib/events/server-event";
import { fetchPublicProfilesByIds } from "@/lib/users/public-profiles";
import { EventPageLayout } from "@/components/events/event-page-layout";
import { EventPageContent } from "@/components/events/event-page-content";
import { EventPageSidebar } from "@/components/events/event-page-sidebar";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface EventJudge {
  id: string;
  name: string;
  bio?: string | null;
  avatarUrl?: string | null;
  affiliation?: string | null;
}

export default async function EventOverviewPage({ params }: PageProps) {
  const { id } = await Promise.resolve(params);
  const [supabase, { data: eventData, error: eventError }] = await Promise.all([
    createSupabaseClient(),
    getEventForRoute(id),
  ]);

  if (eventError || !eventData) {
    notFound();
  }

  // These resources are independent once the event ID is known. Run them
  // together instead of making every round trip wait for the previous one.
  const [
    { data: tracksData },
    { data: lessonsData },
    { data: judgesData },
    { data: { user } },
  ] = await Promise.all([
    supabase.from("event_tracks")
      .select("*, prizes (prize_amount, prize_description)")
      .eq("event_id", eventData.event_id),
    supabase.from("event_lessons")
      .select("title,cover_image_url,url,description,duration_minutes")
      .eq("event_id", eventData.event_id),
    supabase.from("user_event_roles")
      .select("user_id")
      .eq("event_id", eventData.event_id)
      .eq("role", "judge"),
    supabase.auth.getUser(),
  ]);

  // Never mutate the request-memoized event object shared with the layout.
  const typedEvent = {
    ...eventData,
    event_lessons: (lessonsData || []) as Lesson[],
  } as EventDetails & { cover_image_url?: string; event_lessons?: Lesson[] };
  const tracks = (tracksData || []) as EventTrack[];

  // Role visibility stays viewer-scoped; only the profile fields are read
  // with the service client, since user_profiles RLS hides other users.
  const judgeIds = (judgesData || []).flatMap((judgeRecord) =>
    judgeRecord.user_id ? [judgeRecord.user_id] : []
  );
  const judgeProfiles = await fetchPublicProfilesByIds(judgeIds);

  const judges: EventJudge[] = judgeIds.flatMap((judgeId) => {
      const profile = judgeProfiles.get(judgeId);

      if (!profile?.display_name) {
        return [];
      }

      return [
        {
          id: profile.uid,
          name: profile.display_name,
          bio: profile.bio ?? null,
          avatarUrl: profile.avatar_url ?? null,
          affiliation: profile.affiliation ?? null,
        },
      ];
    });

  let hasJoined = false;
  let userRole: EventRole | null = null;
  let userProjects: Array<{
    id: string;
    project_name: string | null;
    project_description: string | null;
    cover_image_url: string | null;
    submitted: boolean | null;
    submitted_at: string | null;
    created_at: string | null;
  }> = [];

  // Member-only content. It is never part of the shared route lookup and is
  // only fetched after the role check below, so it is not serialized into the
  // page for anonymous visitors or non-members (PUB-002).
  let paywallContent: string | null = null;

  if (user) {
    const [{ data: userEventRole }, { data: projectsData }] = await Promise.all([
      supabase.from("user_event_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("event_id", eventData.event_id)
        .maybeSingle(),
      // Team email columns are not client-readable: the caller's projects in
      // this event come from my_project_ids (verified auth email).
      supabase.rpc("my_project_ids", { p_event_id: eventData.event_id }).then(async ({ data: ids, error }) => {
        const projectIds = error ? [] : ((ids ?? []) as unknown as string[]);
        if (projectIds.length === 0) return { data: [] as Array<Record<string, unknown>> };
        return supabase.from("projects")
          .select("id, project_name, project_description, cover_image_url, submitted, submitted_at, created_at")
          .in("id", projectIds);
      }),
    ]);

    hasJoined = !!userEventRole;
    userRole = (userEventRole?.role as EventRole) || null;

    if (hasJoined) {
      // The column is not readable directly; the RPC re-checks membership.
      const { data: paywall } = await supabase.rpc("get_event_paywall_content", {
        p_event_id: eventData.event_id,
      });
      paywallContent = paywall ?? null;
    }

    userProjects = (projectsData || []).map((p) => ({
      id: p.id,
      project_name: p.project_name,
      project_description: p.project_description,
      cover_image_url: p.cover_image_url,
      submitted: p.submitted,
      submitted_at: p.submitted_at,
      created_at: p.created_at,
    }));
  }

  return (
    <EventPageLayout
      eventName={typedEvent.event_name}
      eventBlurb={typedEvent.event_blurb || ""}
      eventDate={typedEvent.event_date}
      location={typedEvent.location}
      coverImageUrl={typedEvent.cover_image_url}
      eventId={id}
      hasJoined={hasJoined}
      dbEventId={eventData.event_id}
      paid={typedEvent.paid}
      eventType={typedEvent.event_type}
    >
      {/* Main Content */}
      <div className="min-w-0 flex-1">
        <EventPageContent
          event={{ ...typedEvent, paywall_content: paywallContent ?? undefined }}
          tracks={tracks}
          hasJoined={hasJoined}
          userRole={userRole}
          judges={judges}
          userProjects={userProjects}
          eventSlug={typedEvent.slug}
          submissionDeadline={typedEvent.submission_time_cutoff}
        />
      </div>

      {/* Sidebar */}
      <EventPageSidebar
        eventResources={typedEvent.event_resources}
        eventId={eventData.event_id}
        eventSlug={typedEvent.slug}
      />
    </EventPageLayout>
  );
}
