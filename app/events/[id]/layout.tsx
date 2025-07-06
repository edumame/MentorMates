import type React from "react";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isValidUUID } from "@/app/utils/supabase/queries";
import { ConditionalEventLayout } from "./conditional-event-layout";
import { RouteBasedLayoutConfig } from "./RouteBasedLayoutConfig";

// add authentication check for non private/public events

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await Promise.resolve(params);
  const supabase = await createSupabaseClient();

  // Check if user is authenticated
  const isUUID = isValidUUID(id);

  let query = supabase.from("events").select(`
    event_id,
    slug,
    event_name,
    event_date,
    location,
    event_blurb,
    event_description,
    cover_image_url
  `);

  if (isUUID) {
    // If it's a UUID, check both slug and event_id
    query = query.or(`slug.eq.${id},event_id.eq.${id}`);
  } else {
    // If it's not a UUID, only check slug
    query = query.eq("slug", id);
  }

  const { data: event } = await query.single();

  if (!event) {
    notFound();
  }

  return (
    <RouteBasedLayoutConfig>
      <ConditionalEventLayout event={event}>
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
  const supabase = await createSupabaseClient();

  const isUUID = isValidUUID(id);

  let query = supabase.from("events").select("event_name");

  if (isUUID) {
    // If it's a UUID, check both slug and event_id
    query = query.or(`slug.eq.${id},event_id.eq.${id}`);
  } else {
    // If it's not a UUID, only check slug
    query = query.eq("slug", id);
  }

  const { data: event } = await query.single();

  return {
    title: event?.event_name || "Event",
  };
}
