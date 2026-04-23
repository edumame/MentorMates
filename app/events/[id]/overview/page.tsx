import React from "react";
import { notFound } from "next/navigation";
import { EventDetails, EventTrack, EventRole, Lesson } from "@/lib/types";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { isValidUUID } from "@/app/utils/supabase/queries";
import {
  getVisibleEventResources,
  normalizeEventResources,
} from "@/lib/utils/event-resources";
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
    paywall_content,
    participant_capacity,
    cover_image_url,
    slug,
    paid,
    event_type,
    submission_time_cutoff
  `);

  if (isUUID) {
    query = query.or(`slug.eq.${id},event_id.eq.${id}`);
  } else {
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

  const typedEvent = eventData as EventDetails & { cover_image_url?: string };
  const normalizedResources = normalizeEventResources(typedEvent.event_resources);
  // Fetch lessons from new event_lessons table
  const { data: lessonsData } = await supabase
    .from("event_lessons")
    .select("title,cover_image_url,url,description,duration_minutes")
    .eq("event_id", eventData.event_id);
  (typedEvent as EventDetails & { event_lessons?: Lesson[] }).event_lessons = (lessonsData || []) as Lesson[];
  const tracks = (tracksData || []) as EventTrack[];

  const { data: judgesData } = await supabase
    .from("user_event_roles")
    .select(
      "user_id, user_profiles!user_id(uid, display_name, bio, avatar_url, affiliation)"
    )
    .eq("event_id", eventData.event_id)
    .eq("role", "judge");

  const judges: EventJudge[] = (judgesData || []).flatMap((judgeRecord) => {
      const profile = Array.isArray(judgeRecord.user_profiles)
        ? judgeRecord.user_profiles[0]
        : judgeRecord.user_profiles;

      if (!profile?.uid || !profile?.display_name) {
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

  // Check if user has joined and get their role
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  if (user) {
    const { data: userEventRole } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("event_id", eventData.event_id)
      .maybeSingle();

    hasJoined = !!userEventRole;
    userRole = (userEventRole?.role as EventRole) || null;

    // Fetch the user's projects for this event so they can always find them
    const userEmail = user.email || "";
    const { data: projectsData } = await supabase
      .from("projects")
      .select(
        "id, project_name, project_description, cover_image_url, submitted, submitted_at, created_at, lead_email"
      )
      .eq("event_id", eventData.event_id)
      .eq("lead_email", userEmail);

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

  const visibleResources = getVisibleEventResources(
    normalizedResources,
    hasJoined
  );
  const eventForRender: EventDetails & { cover_image_url?: string } = {
    ...typedEvent,
    event_resources: visibleResources,
  };

  return (
    <EventPageLayout
      eventName={eventForRender.event_name}
      eventBlurb={eventForRender.event_blurb || ""}
      eventDate={eventForRender.event_date}
      location={eventForRender.location}
      coverImageUrl={eventForRender.cover_image_url}
      eventId={id}
      hasJoined={hasJoined}
      dbEventId={eventData.event_id}
      paid={eventForRender.paid}
      eventType={eventForRender.event_type}
    >
      {/* Main Content */}
      <div className="min-w-0 flex-1">
        <EventPageContent
          event={eventForRender}
          tracks={tracks}
          hasJoined={hasJoined}
          userRole={userRole}
          judges={judges}
          userProjects={userProjects}
          eventSlug={eventForRender.slug}
          submissionDeadline={eventForRender.submission_time_cutoff}
        />
      </div>

      {/* Sidebar */}
      <EventPageSidebar
        eventResources={visibleResources}
        eventId={eventData.event_id}
        eventSlug={eventForRender.slug}
      />
    </EventPageLayout>
  );
}
