import { NextResponse } from "next/server";
import { ApprovalStatus, EventRole, EventVisibility } from "@/lib/types";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { z } from "zod";
import type { Database, Json } from "@/lib/database.types";
import { sendEventApprovalNotification } from "@/lib/email/send-event-approval-notification";
import { canAccessRole } from "@/features/user/roles/roles";

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
  max_projects: z.number().int().positive().optional(),
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
  eventId: z.string().uuid(),
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

    const { event, eventId } = parsed.data;

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

    const { data: roleRow } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: isAdminRpc } = await supabase.rpc("is_admin_user", {
      user_id: user.id,
    });

    const isOrganizer =
      roleRow && canAccessRole(roleRow.role as EventRole, EventRole.Organizer);

    if (!isOrganizer && !Boolean(isAdminRpc)) {
      return NextResponse.json(
        { error: "Only organizers can submit the event for approval" },
        { status: 403 }
      );
    }

    if (existingEvent.visibility !== EventVisibility.Private) {
      return NextResponse.json(
        { error: "Only private events can be submitted for approval" },
        { status: 400 }
      );
    }

    const updatePayload: Database["public"]["Tables"]["events"]["Update"] = {
      approval_status: ApprovalStatus.Submitted,
    };

    if (event) {
      updatePayload.event_name = event.event_name;
      updatePayload.event_date = event.event_date;
      updatePayload.location = event.location;
      updatePayload.rules = ((event.rules ?? []) as unknown as Json);
      updatePayload.slug = event.slug ?? null;
      updatePayload.cover_image_url = event.cover_image_url ?? null;
      updatePayload.event_description = event.event_description ?? null;
      updatePayload.event_blurb = event.event_blurb ?? null;
      updatePayload.submission_time_start = event.submission_time_start ?? null;
      updatePayload.submission_time_cutoff = event.submission_time_cutoff ?? null;
      updatePayload.participant_capacity = event.participant_capacity ?? null;
      updatePayload.max_projects = event.max_projects ?? null;
      updatePayload.paid = event.paid ?? null;
      updatePayload.stripe_price_id = event.stripe_price_id ?? null;
      updatePayload.event_schedule = (event.event_schedule as Json) ?? null;
      updatePayload.event_resources = (event.event_resources as Json) ?? ([] as Json);
      updatePayload.faq = event.faq ?? null;
    }

    const { data: updatedEvent, error: updateError } = await supabase
      .from("events")
      .update(updatePayload)
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

    await supabase.from("event_approval_logs").insert({
      event_id: eventId,
      previous_status: existingEvent.approval_status || ApprovalStatus.NotSubmitted,
      new_status: ApprovalStatus.Submitted,
      admin_user_id: user.id,
      notes: "Event submitted for approval",
    });

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
  } catch (error) {
    console.error("Error in POST /api/events/request-approval:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
