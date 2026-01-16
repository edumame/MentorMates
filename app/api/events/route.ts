import { NextResponse } from "next/server";
import { ApprovalStatus, EventRole, EventVisibility } from "@/lib/types";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { defaultRules } from "@/lib/config/constants";
import { z } from "zod";
import type { Database, Json } from "@/lib/database.types";

export async function GET() {
  const supabase = await createSupabaseClient();

  try {
    // Check if user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // If not authenticated, only return public and private events (exclude archived) that are approved
      const { data: visibleEvents, error: visibleError } = await supabase
        .from("events")
        .select(
          `event_id, 
          event_name, 
          slug, 
          event_blurb, 
          cover_image_url,
          event_date,
          visibility,
          featured,
          approval_status`
        )
        .in("visibility", [EventVisibility.Public, EventVisibility.Private])
        .eq("approval_status", ApprovalStatus.Approved);

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

    // Check if user is an admin in any event via DB function
    const { data: isAdmin } = await supabase.rpc("is_admin_user", {
      user_id: userId,
    });

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
      // - Archived events where user is an organizer
      // - No demo or test events
      query = query.or(
        `visibility.in.(${[EventVisibility.Public, EventVisibility.Private].join(",")}),` +
          `and(visibility.eq.${EventVisibility.Draft},event_id.in.(${organizerEventIds.join(",")})),` +
          `and(visibility.eq.${EventVisibility.Archived},event_id.in.(${organizerEventIds.join(",")}))`
      );
    } else {
      // Regular users only see public and private events (exclude archived) that are approved
      query = query
        .in("visibility", [EventVisibility.Public, EventVisibility.Private])
        .eq("approval_status", ApprovalStatus.Approved);
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

const eventSchema = z.object({
  event_name: z.string().min(3, "Event name must be at least 3 characters"),
  event_date: z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
    message: "Invalid event_date - expected ISO date string",
  }),
  location: z.string().min(1, "Location is required"),
  visibility: z.nativeEnum(EventVisibility).optional(),
  slug: z.string().min(1).optional(),
  cover_image_url: z.string().url().optional(),
  event_description: z.string().optional(),
  event_blurb: z.string().optional(),
  submission_time_start: z.string().optional(),
  submission_time_cutoff: z.string().optional(),
  paid: z.boolean().optional(),
  stripe_price_id: z.string().optional(),
  rules: z
    .array(
      z.object({
        title: z.string(),
        items: z.array(z.string()),
      })
    )
    .optional(),
  approval_status: z.nativeEnum(ApprovalStatus).optional(),
  featured: z.boolean().optional(),
});

const payloadSchema = z.object({
  event: eventSchema,
  organizerEmails: z.array(z.string().email()).optional(),
});

export async function POST(req: Request) {
  const supabase = await createSupabaseClient();

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin via DB function (preferred over client constants)
    const { data: isAdmin } = await supabase.rpc("is_admin_user", {
      user_id: user.id,
    });
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const json = await req.json();
    const parsed = payloadSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { event, organizerEmails = [] } = parsed.data;

    // Build insert payload, providing sane defaults
    const insertPayload: Database["public"]["Tables"]["events"]["Insert"] = {
      event_name: event.event_name,
      event_date: event.event_date,
      location: event.location,
      rules: (event.rules && event.rules.length > 0
        ? event.rules
        : defaultRules) as unknown as Json,
      visibility: (event.visibility ??
        EventVisibility.Draft) as Database["public"]["Enums"]["event_visibility"],
      slug: event.slug ?? null,
      cover_image_url: event.cover_image_url ?? null,
      event_description: event.event_description ?? null,
      event_blurb: event.event_blurb ?? null,
      submission_time_start: event.submission_time_start ?? null,
      submission_time_cutoff: event.submission_time_cutoff ?? null,
      paid: event.paid ?? null,
      stripe_price_id: event.stripe_price_id ?? null,
      owner_id: user.id, // Set the creator as the owner
      approval_status: event.approval_status ?? ApprovalStatus.NotSubmitted, // Events default to not_submitted (visibility controls draft/private/public)
      featured: event.featured ?? false,
    };

    const { data: createdEvent, error: insertError } = await supabase
      .from("events")
      .insert(insertPayload)
      .select("*")
      .single();

    if (insertError || !createdEvent) {
      console.error("Error creating event:", insertError);
      return NextResponse.json(
        { error: "Failed to create event" },
        { status: 500 }
      );
    }

    let assignedCount = 0;
    const missingEmails: string[] = [];

    if (organizerEmails.length > 0) {
      const normalizedEmails = organizerEmails.map((e) =>
        e.trim().toLowerCase()
      );

      // Fetch all users by email in one query
      const { data: usersByEmail, error: usersError } = await supabase
        .from("user_profiles")
        .select("uid, email")
        .in("email", normalizedEmails);

      if (usersError) {
        console.error("Error fetching organizer users:", usersError);
        return NextResponse.json(
          { error: "Failed to look up organizer emails" },
          { status: 500 }
        );
      }

      const foundEmails = new Set(
        (usersByEmail || []).map((u) => (u.email || "").toLowerCase())
      );
      for (const email of normalizedEmails) {
        if (!foundEmails.has(email)) missingEmails.push(email);
      }

      if (usersByEmail && usersByEmail.length > 0) {
        const upserts = usersByEmail.map((u) => ({
          user_id: u.uid,
          event_id: createdEvent.event_id,
          role: EventRole.Organizer,
          updated_at: new Date().toISOString(),
        }));

        const { error: upsertError } = await supabase
          .from("user_event_roles")
          .upsert(upserts, { onConflict: "user_id,event_id" });

        if (upsertError) {
          console.error("Error assigning organizers:", upsertError);
          return NextResponse.json(
            { error: "Event created but assigning organizers failed" },
            { status: 500 }
          );
        }

        assignedCount = upserts.length;
      }
    }

    return NextResponse.json(
      {
        event: createdEvent,
        organizersAssigned: assignedCount,
        missingOrganizerEmails: missingEmails,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/events:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
