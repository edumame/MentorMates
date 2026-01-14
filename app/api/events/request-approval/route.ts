import { NextResponse } from "next/server";
import { ApprovalStatus, EventRole, EventVisibility } from "@/lib/types";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { defaultRules } from "@/lib/config/constants";
import { z } from "zod";
import type { Database, Json } from "@/lib/database.types";

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
      // Verify user owns the event
      const { data: existingEvent, error: fetchError } = await supabase
        .from("events")
        .select("event_id, owner_id, approval_status")
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
      paid: event.paid ?? null,
      stripe_price_id: event.stripe_price_id ?? null,
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
      .insert({
        user_id: user.id,
        event_id: createdEvent.event_id,
        role: EventRole.Organizer,
        updated_at: new Date().toISOString(),
      });

    if (roleError) {
      console.error("Error assigning creator as organizer:", roleError);
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

    // Create an approval log entry
    await supabase.from("event_approval_logs").insert({
      event_id: createdEvent.event_id,
      previous_status: ApprovalStatus.NotSubmitted,
      new_status: ApprovalStatus.Submitted,
      admin_user_id: user.id,
      notes: "Event submitted for approval",
    });

    return NextResponse.json(
      {
        event: createdEvent,
        organizersAssigned: assignedCount,
        missingOrganizerEmails: missingEmails,
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
