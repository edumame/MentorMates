import { NextResponse } from "next/server";
import { ApprovalStatus, EventRole, EventVisibility } from "@/lib/types";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import {
  getVisibleEventResources,
  normalizeEventResources,
} from "@/lib/utils/event-resources";
import { z } from "zod";
import type { Database, Json } from "@/lib/database.types";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { randomUUID } from "crypto";
import { Resend } from "resend";
import { NOTIFICATIONS_EMAIL_FROM } from "@/lib/email_templates/constants";
import {
  sendEventInviteEmails,
  sendOrganizerInviteEmails,
} from "@/lib/events/invite-emails";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

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

      const canViewPrivateResources = Boolean(isAdmin) || Boolean(userRole);
      const visibleResources = getVisibleEventResources(
        normalizeEventResources(event.event_resources),
        canViewPrivateResources
      );

      return {
        ...event,
        event_resources: visibleResources,
        userRole,
      };
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
  external_url: z.string().url("external_url must be a valid URL").optional(),
  external_redirect_enabled: z.boolean().optional(),
  submission_time_start: z.string().optional(),
  submission_time_cutoff: z.string().optional(),
  participant_capacity: z.number().int().nonnegative().optional(),
  paid: z.boolean().optional(),
  stripe_price_id: z.string().optional(),
  event_schedule: z.array(z.record(z.string(), z.unknown())).optional(),
  event_resources: z
    .array(
      z.object({
        name: z.string(),
        link: z.string(),
      })
    )
    .optional(),
  faq: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string(),
      })
    )
    .optional(),
  tracks: z
    .array(
      z.object({
        client_id: z.string().min(1),
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        scoring_criteria: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .optional(),
  prizes: z
    .array(
      z.object({
        track_client_id: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
        cover_image_url: z.string().url().nullable().optional(),
      })
    )
    .optional(),
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
  event_type: z.array(z.string()).optional(),
});

const payloadSchema = z.object({
  event: eventSchema,
  participantInviteEmails: z.array(z.string().email()).optional(),
  judgeInviteEmails: z.array(z.string().email()).optional(),
  organizerEmails: z.array(z.string().email()).optional(),
});

export async function POST(req: Request) {
  const supabase = await createSupabaseClient();
  const serviceSupabase = createSupabaseServiceClient();

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin via DB function; no longer needed for general event creation flow

    // const { data: isAdmin } = await supabase.rpc("is_admin_user", {
    //   user_id: user.id,
    // });
    // if (!isAdmin) {
    //   return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // }

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

    const {
      event,
      participantInviteEmails = [],
      judgeInviteEmails = [],
      organizerEmails = [],
    } = parsed.data;

    // Build insert payload, providing sane defaults
    const insertPayload: Database["public"]["Tables"]["events"]["Insert"] = {
      event_name: event.event_name,
      event_date: event.event_date,
      location: event.location,
      rules: ((event.rules ?? []) as unknown as Json),
      visibility: (event.visibility ??
        EventVisibility.Draft) as Database["public"]["Enums"]["event_visibility"],
      slug: event.slug ?? null,
      cover_image_url: event.cover_image_url ?? null,
      event_description: event.event_description ?? null,
      event_blurb: event.event_blurb ?? null,
      external_url: event.external_url ?? null,
      external_redirect_enabled: event.external_redirect_enabled ?? false,
      submission_time_start: event.submission_time_start ?? null,
      submission_time_cutoff: event.submission_time_cutoff ?? null,
      participant_capacity: event.participant_capacity ?? null,
      paid: event.paid ?? null,
      stripe_price_id: event.stripe_price_id ?? null,
      ...(event.event_schedule ? { event_schedule: event.event_schedule as Json } : {}),
      event_resources: (event.event_resources as Json) ?? ([] as Json),
      faq: (event.faq as Json) ?? null,
      owner_id: user.id, // Set the creator as the owner
      approval_status: event.approval_status ?? ApprovalStatus.NotSubmitted, // Events default to not_submitted (visibility controls draft/private/public)
      featured: event.featured ?? false,
      event_type: (event.event_type ?? []) as string[],
    };

    const { data: createdEvent, error: insertError } = await supabase
      .from("events")
      .insert(insertPayload)
      .select("*")
      .single();

    if (insertError || !createdEvent) {
      console.error("Error creating event:", insertError);

      if (insertError?.message?.toLowerCase().includes("events_slug_key")) {
        return NextResponse.json(
          { error: "Event slug already exists. Please try a different slug." },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "Failed to create event" },
        { status: 500 }
      );
    }

    const { error: creatorRoleError } = await supabase
      .from("user_event_roles")
      .upsert(
        {
          user_id: user.id,
          event_id: createdEvent.event_id,
          role: EventRole.Organizer,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,event_id" }
      );

    if (creatorRoleError) {
      console.error("Error assigning creator as organizer:", creatorRoleError);
      return NextResponse.json(
        { error: "Event created but assigning creator role failed" },
        { status: 500 }
      );
    }

    const clientToDbTrackId = new Map<string, string>();
    if (event.tracks && event.tracks.length > 0) {
      const trackInserts: Database["public"]["Tables"]["event_tracks"]["Insert"][] =
        event.tracks.map((track) => {
          const trackId = randomUUID();
          clientToDbTrackId.set(track.client_id, trackId);

          return {
            track_id: trackId,
            event_id: createdEvent.event_id,
            name: track.name,
            description: track.description ?? null,
            scoring_criteria: (track.scoring_criteria as Json) ?? null,
            updated_at: new Date().toISOString(),
          };
        });

      const { error: trackInsertError } = await supabase
        .from("event_tracks")
        .insert(trackInserts);

      if (trackInsertError) {
        console.error("Error creating tracks:", trackInsertError);
        return NextResponse.json(
          { error: "Event created but creating tracks failed" },
          { status: 500 }
        );
      }
    }

    const skippedPrizes: string[] = [];
    if (event.prizes && event.prizes.length > 0) {
      const prizeInserts: Database["public"]["Tables"]["prizes"]["Insert"][] = [];

      for (const prize of event.prizes) {
        const dbTrackId = clientToDbTrackId.get(prize.track_client_id);
        if (!dbTrackId) {
          skippedPrizes.push(prize.track_client_id);
          continue;
        }

        prizeInserts.push({
          track_id: dbTrackId,
          prize_amount: prize.name,
          prize_description: prize.description ?? "",
          updated_at: new Date().toISOString(),
        });
      }

      if (prizeInserts.length > 0) {
        const { error: prizeInsertError } = await supabase
          .from("prizes")
          .insert(prizeInserts);

        if (prizeInsertError) {
          console.error("Error creating prizes:", prizeInsertError);
          return NextResponse.json(
            { error: "Event created but creating prizes failed" },
            { status: 500 }
          );
        }
      }
    }

    const { data: inviterProfile } = await supabase
      .from("user_profiles")
      .select("display_name, email")
      .eq("uid", user.id)
      .maybeSingle();

    const inviterName =
      inviterProfile?.display_name?.trim() ||
      inviterProfile?.email?.trim() ||
      "A MentorMates organizer";
    const inviterEmail = user.email?.trim().toLowerCase() || null;

    let assignedCount = 1;
    const missingEmails: string[] = [];
    const existingOrganizerInviteEmails: string[] = [];
    const newOrganizerInviteEmails: string[] = [];

    if (organizerEmails.length > 0) {
      const normalizedEmails = Array.from(
        new Set(
          organizerEmails
            .map((e) => e.trim().toLowerCase())
            .filter((email) => email && email !== inviterEmail)
        )
      );

      // Fetch all users by email in one query
      const { data: usersByEmail, error: usersError } = await serviceSupabase
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
        if (!foundEmails.has(email)) {
          missingEmails.push(email);
          newOrganizerInviteEmails.push(email);
        }
      }

      if (usersByEmail && usersByEmail.length > 0) {
        const upserts = usersByEmail
          .filter((u) => u.uid !== user.id)
          .map((u) => ({
          user_id: u.uid,
          event_id: createdEvent.event_id,
          role: EventRole.Organizer,
          updated_at: new Date().toISOString(),
        }));

        if (upserts.length > 0) {
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

          assignedCount += upserts.length;
        }

        existingOrganizerInviteEmails.push(
          ...usersByEmail
            .filter((u) => u.uid !== user.id)
            .map((u) => (u.email || "").trim().toLowerCase())
            .filter(Boolean)
        );
      }
    }

    const resend = getResend();
    const sendEmail = resend
      ? async ({ to, subject, html }: { to: string; subject: string; html: string }) => {
          try {
            const { error } = await resend.emails.send({
              from: NOTIFICATIONS_EMAIL_FROM,
              to,
              subject,
              html,
            });

            if (error) {
              console.error("Failed to send event invite email:", error);
              return false;
            }

            return true;
          } catch (emailError) {
            console.error("Error sending event invite email:", emailError);
            return false;
          }
        }
      : undefined;

    const organizerInviteSummary = await sendOrganizerInviteEmails({
      appOrigin: process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin,
      eventId: createdEvent.event_id,
      eventName: createdEvent.event_name,
      eventSlug: createdEvent.slug,
      inviterName,
      existingOrganizerEmails: existingOrganizerInviteEmails,
      newOrganizerEmails: newOrganizerInviteEmails,
      sendEmail,
    });

    const inviteSummary = await sendEventInviteEmails({
      appOrigin: process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin,
      eventId: createdEvent.event_id,
      eventName: createdEvent.event_name,
      eventSlug: createdEvent.slug,
      inviterName,
      visibility:
        (createdEvent.visibility as EventVisibility | null) ??
        EventVisibility.Draft,
      participantInviteEmails,
      judgeInviteEmails,
      sendEmail,
    });

    return NextResponse.json(
      {
        event: createdEvent,
        organizersAssigned: assignedCount,
        missingOrganizerEmails: missingEmails,
        organizerInviteSummary,
        inviteSummary,
        skippedPrizeTrackIds: skippedPrizes,
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
