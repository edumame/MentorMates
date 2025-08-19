import { NextResponse } from "next/server";
import { EventRole, EventVisibility } from "@/lib/types";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { ADMIN_USER_IDS } from "@/lib/config/constants";
import { defaultRules } from "@/lib/config/constants";

type CreateEventRequestBody = {
  eventName: string;
  eventDate: string; // ISO or free text; stored as text in DB
  location?: string;
  eventDescription?: string;
  eventBlurb?: string;
  coverImageUrl?: string;
  visibility?: EventVisibility;
  slug?: string;
  submissionTimeStart?: string;
  submissionTimeCutoff?: string;
  roleLabels?: Record<string, string>;
  organizerEmails?: string[]; // optional list of organizer emails to assign
  organizerUserIds?: string[]; // optional list of organizer user IDs to assign
};

function generateSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 64);
}

export async function GET() {
  const supabase = await createSupabaseClient();

  try {
    // Check if user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // If not authenticated, only return public and private events
      const { data: visibleEvents, error: visibleError } = await supabase
        .from("events")
        .select(
          "event_id, event_name, event_slug, event_blurb"
        )
        .in("visibility", [EventVisibility.Public, EventVisibility.Private]);

      if (visibleError) throw visibleError;
      return NextResponse.json({ events: visibleEvents });
    }

    const userId = user.id;

    // Get user's roles in all events
    const { data: userRoles, error: rolesError } = await supabase
      .from("user_event_roles")
      .select("event_id, role")
      .eq("user_id", userId);

    if (rolesError) throw rolesError;

    // Check if user is an admin in any event
    const isAdmin = ADMIN_USER_IDS.includes(userId);

    // Get event IDs where user is an organizer
    const organizerEventIds = userRoles
      .filter((role) => role.role === EventRole.Organizer)
      .map((role) => role.event_id);

    // Build query for events based on visibility and user role
    let query = supabase.from("events").select("*");

    if (isAdmin) {
      // Admins can see all events (public, private, draft, demo, test)
      // No additional filter needed
    } else if (organizerEventIds.length > 0) {
      // For organizers:
      // - Public and private events (visible to everyone)
      // - Draft events where user is an organizer
      // - No demo or test events
      query = query.or(
        `visibility.in.(${[EventVisibility.Public, EventVisibility.Private].join(",")}),` +
          `and(visibility.eq.${EventVisibility.Draft},event_id.in.(${organizerEventIds.join(",")}))`
      );
    } else {
      // Regular users only see public and private events
      query = query.in("visibility", [
        EventVisibility.Public,
        EventVisibility.Private,
      ]);
    }

    const { data: events, error: eventsError } = await query;

    if (eventsError) throw eventsError;

    // Include user role with each event
    const eventsWithRole = events.map((event) => {
      const userRole =
        userRoles.find((role) => role.event_id === event.event_id)?.role ||
        null;
      return { ...event, userRole };
    });

    return NextResponse.json({ events: eventsWithRole });
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const supabase = await createSupabaseClient();

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdminUser = ADMIN_USER_IDS.includes(user.id);
    if (!isAdminUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as CreateEventRequestBody;

    const {
      eventName,
      eventDate,
      location,
      eventDescription,
      eventBlurb,
      coverImageUrl,
      visibility,
      slug,
      submissionTimeStart,
      submissionTimeCutoff,
      roleLabels,
      organizerEmails,
      organizerUserIds,
    } = body;

    if (!eventName || !eventDate) {
      return NextResponse.json(
        { error: "Missing required fields: eventName, eventDate" },
        { status: 400 }
      );
    }

    const computedSlug = slug && slug.trim().length > 0 ? slug.trim() : generateSlugFromName(eventName);

    const { data: createdEvent, error: insertError } = await supabase
      .from("events")
      .insert({
        event_name: eventName,
        event_date: eventDate,
        location: location || null,
        event_description: eventDescription || null,
        event_blurb: eventBlurb || null,
        cover_image_url: coverImageUrl || null,
        rules: defaultRules as unknown as Record<string, unknown>,
        visibility: visibility || EventVisibility.Draft,
        slug: computedSlug,
        submission_time_start: submissionTimeStart || null,
        submission_time_cutoff: submissionTimeCutoff || null,
        role_labels: roleLabels || null,
      })
      .select("event_id")
      .single();

    if (insertError || !createdEvent) {
      return NextResponse.json(
        { error: "Failed to create event" },
        { status: 500 }
      );
    }

    const newEventId = createdEvent.event_id as string;

    // Resolve organizer user IDs from emails if provided
    const organizerIds: string[] = [];

    if (Array.isArray(organizerUserIds) && organizerUserIds.length > 0) {
      organizerIds.push(
        ...organizerUserIds.filter((id) => typeof id === "string" && id.length > 0)
      );
    }

    if (Array.isArray(organizerEmails) && organizerEmails.length > 0) {
      const normalizedEmails = organizerEmails
        .map((e) => (typeof e === "string" ? e.trim().toLowerCase() : ""))
        .filter((e) => e.length > 0);

      if (normalizedEmails.length > 0) {
        const { data: usersByEmail, error: usersError } = await supabase
          .from("user_profiles")
          .select("uid, email")
          .in("email", normalizedEmails);

        if (usersError) {
          return NextResponse.json(
            { error: "Failed to resolve organizer emails" },
            { status: 500 }
          );
        }

        if (usersByEmail && usersByEmail.length > 0) {
          organizerIds.push(...usersByEmail.map((u: { uid: string }) => u.uid));
        }
      }
    }

    // Upsert organizer roles
    if (organizerIds.length > 0) {
      const upsertRows = organizerIds.map((uid) => ({
        user_id: uid,
        event_id: newEventId,
        role: EventRole.Organizer,
        updated_at: new Date().toISOString(),
      }));

      const { error: roleUpsertError } = await supabase
        .from("user_event_roles")
        .upsert(upsertRows, { onConflict: "user_id,event_id" });

      if (roleUpsertError) {
        return NextResponse.json(
          { error: "Event created, but failed to assign organizers" },
          { status: 207 }
        );
      }
    }

    return NextResponse.json({ eventId: newEventId }, { status: 201 });
  } catch (error) {
    console.error("Error creating event:", error);
    return NextResponse.json(
      { error: "Failed to create event" },
      { status: 500 }
    );
  }
}
