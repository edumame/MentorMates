import { NextResponse } from "next/server";
import { ApprovalStatus, EventRole, EventVisibility } from "@/lib/types";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { defaultRules } from "@/lib/config/constants";
import { z } from "zod";
import type { Database, Json } from "@/lib/database.types";
import { randomUUID } from "crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { sendEventApprovalNotification } from "@/lib/email/send-event-approval-notification";

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
  faq: z.string().optional(),
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
});

const payloadSchema = z.object({
  event: eventSchema.optional(),
  organizerEmails: z.array(z.string().email()).optional(),
  eventId: z.string().uuid().optional(),
}).refine((data) => data.event || data.eventId, {
  message: "Either event or eventId must be provided",
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

    const { event, organizerEmails = [], eventId } = parsed.data;

    // If eventId is provided, update existing event instead of creating new one
    if (eventId) {
      // Verify user owns the event and check visibility
      const { data: existingEvent, error: fetchError } = await supabase
        .from("events")
        .select("event_id, owner_id, approval_status, visibility")
        .eq("event_id", eventId)
        .single();

      if (fetchError || !existingEvent) {
        return NextResponse.json(
          { error: "Event not found" },
          { status: 404 }
        );
      }

      if (existingEvent.owner_id !== user.id) {
        return NextResponse.json(
          { error: "Unauthorized - You don't own this event" },
          { status: 403 }
        );
      }

      // Only allow submission for private events
      if (existingEvent.visibility !== EventVisibility.Private) {
        return NextResponse.json(
          { error: "Only private events can be submitted for approval" },
          { status: 400 }
        );
      }

      // Update approval status to submitted
      const { data: updatedEvent, error: updateError } = await supabase
        .from("events")
        .update({ approval_status: ApprovalStatus.Submitted })
        .eq("event_id", eventId)
        .select("*")
        .single();

      if (updateError || !updatedEvent) {
        console.error("Error updating event approval status:", updateError);
        return NextResponse.json(
          { error: "Failed to update event approval status" },
          { status: 500 }
        );
      }

      // Create an approval log entry
      await supabase.from("event_approval_logs").insert({
        event_id: eventId,
        previous_status: existingEvent.approval_status || ApprovalStatus.NotSubmitted,
        new_status: ApprovalStatus.Submitted,
        admin_user_id: user.id,
        notes: "Event submitted for approval",
      });

      // Send email notification to admins (fire-and-forget so it doesn't block the response)
      sendEventApprovalNotification({
        eventName: updatedEvent.event_name || "Untitled Event",
        organizerName: user.user_metadata?.full_name || user.email || "Unknown",
        organizerEmail: user.email || "",
        eventDate: updatedEvent.event_date || "TBD",
        location: updatedEvent.location || "TBD",
        eventId: updatedEvent.slug || updatedEvent.event_id,
      }).catch((err) => console.error("Failed to send approval notification email:", err));

      return NextResponse.json(
        {
          event: updatedEvent,
        },
        { status: 200 }
      );
    }

    // Original flow: create new event
    if (!event) {
      return NextResponse.json(
        { error: "Event data is required when eventId is not provided" },
        { status: 400 }
      );
    }

    // Build insert payload with approval_status set to 'submitted'
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
      participant_capacity: event.participant_capacity ?? null,
      paid: event.paid ?? null,
      stripe_price_id: event.stripe_price_id ?? null,
      event_schedule: (event.event_schedule as Json) ?? null,
      event_resources: (event.event_resources as Json) ?? ([] as Json),
      faq: event.faq ?? null,
      owner_id: user.id,
      approval_status: ApprovalStatus.Submitted, // Set to submitted for approval
    };

    const { data: createdEvent, error: insertError } = await supabase
      .from("events")
      .insert(insertPayload)
      .select("*")
      .single();

    if (insertError || !createdEvent) {
      console.error("Error creating event for approval:", insertError);
      return NextResponse.json(
        { error: "Failed to create event" },
        { status: 500 }
      );
    }

    // Automatically assign the creator as an organizer
    const { error: roleError } = await supabase
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

    if (roleError) {
      console.error("Error assigning creator as organizer:", roleError);
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

    let assignedCount = 1;
    const missingEmails: string[] = [];

    if (organizerEmails.length > 0) {
      const normalizedEmails = Array.from(new Set(organizerEmails.map((e) =>
        e.trim().toLowerCase()
      )));

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
        if (!foundEmails.has(email)) missingEmails.push(email);
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
      }
    }

    // Create an approval log entry
    await supabase.from("event_approval_logs").insert({
      event_id: createdEvent.event_id,
      previous_status: ApprovalStatus.NotSubmitted,
      new_status: ApprovalStatus.Submitted,
      admin_user_id: user.id,
      notes: "Event submitted for approval",
    });

    // Send email notification to admins (fire-and-forget so it doesn't block the response)
    sendEventApprovalNotification({
      eventName: createdEvent.event_name || "Untitled Event",
      organizerName: user.user_metadata?.full_name || user.email || "Unknown",
      organizerEmail: user.email || "",
      eventDate: createdEvent.event_date || "TBD",
      location: createdEvent.location || "TBD",
      eventId: createdEvent.slug || createdEvent.event_id,
    }).catch((err) => console.error("Failed to send approval notification email:", err));

    return NextResponse.json(
      {
        event: createdEvent,
        organizersAssigned: assignedCount,
        missingOrganizerEmails: missingEmails,
        skippedPrizeTrackIds: skippedPrizes,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/events/request-approval:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
