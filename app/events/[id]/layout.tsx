import type React from "react";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getEventForRoute } from "@/lib/events/server-event";
import { ConditionalEventLayout } from "./conditional-event-layout";
import { RouteBasedLayoutConfig } from "./RouteBasedLayoutConfig";
import {
  canUseInternalEventRoute,
  getExternalRedirectUrl,
  isPublicEventHiddenByReview,
} from "@/lib/events/navigation";

// add authentication check for non private/public events

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await Promise.resolve(params);
  const { data: event } = await getEventForRoute(id);

  if (!event) {
    notFound();
  }

  const externalUrl = getExternalRedirectUrl(event);
  // Submitted or rejected public events are not live: only people who manage
  // the event (or its submitter) may open them by direct link.
  const hiddenByReview = isPublicEventHiddenByReview(event);
  if (externalUrl || hiddenByReview) {
    const supabase = await createSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let canUseInternalEventPage = false;

    if (user) {
      const [{ data: userEventRole }, { data: isGlobalAdmin }] = await Promise.all([
        supabase
          .from("user_event_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("event_id", event.event_id)
          .maybeSingle(),
        supabase.rpc("is_admin_user", { user_id: user.id }),
      ]);

      canUseInternalEventPage = canUseInternalEventRoute({
        userRole: userEventRole?.role,
        canManageEvent: Boolean(isGlobalAdmin),
      });
    }

    if (hiddenByReview && !canUseInternalEventPage) {
      // A signed-in submitter owns the event but has no organizer role.
      // owner_id is not part of the shared route columns, so look it up here.
      let isOwner = false;
      if (user) {
        const { data: ownership } = await supabase
          .from("events")
          .select("owner_id")
          .eq("event_id", event.event_id)
          .maybeSingle();
        isOwner = ownership?.owner_id === user.id;
      }
      if (!isOwner) notFound();
    }

    if (externalUrl && !canUseInternalEventPage) {
      redirect(externalUrl);
    }
  }

  return (
    <RouteBasedLayoutConfig>
      <ConditionalEventLayout event={{
        event_id: event.event_id,
        event_name: event.event_name,
        event_date: event.event_date,
        location: event.location,
        event_blurb: event.event_blurb,
        event_description: event.event_description,
        cover_image_url: event.cover_image_url,
        slug: event.slug,
        submission_time_start: event.submission_time_start,
        submission_time_cutoff: event.submission_time_cutoff,
        visibility: event.visibility,
      }}>
        {children}
      </ConditionalEventLayout>
    </RouteBasedLayoutConfig>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await Promise.resolve(params);
  const { data: event } = await getEventForRoute(id);

  // The 404 for these events must not carry the unreviewed title or blurb.
  if (event && isPublicEventHiddenByReview(event)) {
    return { title: "Event" };
  }

  const path = event?.slug ? `/events/${event.slug}` : `/events/${id}`;
  const description = event?.event_blurb || event?.event_description || undefined;

  return {
    title: event?.event_name || "Event",
    description,
    openGraph: {
      title: event?.event_name || "Event",
      description,
      url: path,
      type: "website",
      images: event?.cover_image_url
        ? [
            {
              url: event.cover_image_url,
              width: 1200,
              height: 630,
              alt: `${event?.event_name ?? "Event"} cover`,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: event?.event_name || "Event",
      description,
      images: event?.cover_image_url ? [event.cover_image_url] : undefined,
    },
    alternates: {
      canonical: path,
    },
  };
}
