import "server-only";
import { cache } from "react";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { lookupByEventRouteParam } from "./resolve-event-route";

// Columns every visitor of an event route may receive. Do not add member-only
// content here (e.g. paywall_content): this result is rendered for anonymous
// visitors and serialized into the RSC payload. Member-only content is fetched
// separately after a role check (app/events/[id]/overview/page.tsx).
export const EVENT_ROUTE_COLUMNS = `
    event_id, slug, event_name, event_date, location, event_blurb,
    event_description, cover_image_url, submission_time_start,
    submission_time_cutoff, visibility, external_url, external_redirect_enabled,
    approval_status, rules, event_schedule, event_prizes, event_resources,
    participant_capacity, paid, event_type
  `;

// React cache is scoped to one server render/request, not shared across users.
// Keep the cookie-bound client and RLS: never replace this with a persistent
// cache or service-role query. Layout, metadata and overview share this lookup.
export const getEventForRoute = cache(async (id: string) => {
  const supabase = await createSupabaseClient();
  // Shared precedence rule (id before slug): see resolve-event-route.ts.
  return lookupByEventRouteParam(id, (column, value) =>
    supabase.from("events").select(EVENT_ROUTE_COLUMNS).eq(column, value).maybeSingle()
  );
});
