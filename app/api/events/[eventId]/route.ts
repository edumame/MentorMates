import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EventRole, EventVisibility } from "@/lib/types";
import { canAccessRole } from "@/features/user/roles/roles";
import { z } from "zod";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const supabase = await createSupabaseClient();

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { eventId } = await params;
    if (!eventId) {
      return NextResponse.json(
        { error: "Event ID is required" },
        { status: 400 }
      );
    }

    // Verify permission: organizer of this event OR global admin
    const { data: roleRow } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();

    let isAllowed = false;
    if (
      roleRow &&
      canAccessRole(roleRow.role as EventRole, EventRole.Organizer)
    ) {
      isAllowed = true;
    } else {
      const { data: isAdmin } = await supabase.rpc("is_admin_user", {
        user_id: user.id,
      });
      isAllowed = Boolean(isAdmin);
    }

    if (!isAllowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Ensure event exists
    const { data: event } = await supabase
      .from("events")
      .select("event_id")
      .eq("event_id", eventId)
      .maybeSingle();
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Manual cleanup for related tables that do NOT have ON DELETE CASCADE
    // Order chosen to respect FKs observed in schema
    // user_event_payments are not deleted
    // 1) Delete event_tickets (FK -> user_event_payments, user_profiles) by event_id
    await supabase.from("event_tickets").delete().eq("event_id", eventId);

    // 2) Delete prize winners and prizes via event_tracks join
    const { data: trackIds } = await supabase
      .from("event_tracks")
      .select("track_id")
      .eq("event_id", eventId);
    if (trackIds && trackIds.length > 0) {
      const ids = trackIds.map((t) => t.track_id);
      // Fetch prize IDs for those tracks
      const { data: prizesForTracks } = await supabase
        .from("prizes")
        .select("id")
        .in("track_id", ids);

      const prizeIds = (prizesForTracks || []).map((p) => p.id);

      if (prizeIds.length > 0) {
        // Remove prize winners first (no cascade on prize_winners -> prizes)
        await supabase.from("prize_winners").delete().in("prize_id", prizeIds);
      }

      // Now remove the prizes themselves
      await supabase.from("prizes").delete().in("track_id", ids);
      // project_scores and project_tracks FKs already cascade on track_id
    }

    // 4) Delete event_tracks for this event (prizes are already removed)
    await supabase.from("event_tracks").delete().eq("event_id", eventId);

    // 5) platform_engagement, feedback reference events without cascade
    await supabase.from("platform_engagement").delete().eq("event_id", eventId);
    await supabase.from("feedback").delete().eq("event_id", eventId);

    // 6) role_passwords, user_event_roles have ON DELETE CASCADE; but clear anyway for safety
    await supabase.from("role_passwords").delete().eq("event_id", eventId);
    await supabase.from("user_event_roles").delete().eq("event_id", eventId);

    // Finally, delete the event
    const { error: deleteEventError } = await supabase
      .from("events")
      .delete()
      .eq("event_id", eventId);

    if (deleteEventError) {
      return NextResponse.json(
        { error: deleteEventError.message || "Failed to delete event" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting event:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

const archiveSchema = z.object({
  action: z.enum(["archive", "unarchive"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const supabase = await createSupabaseClient();

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { eventId } = await params;
    if (!eventId) {
      return NextResponse.json(
        { error: "Event ID is required" },
        { status: 400 }
      );
    }

    const { data: isAdmin } = await supabase.rpc("is_admin_user", {
      user_id: user.id,
    });
    if (!isAdmin) {
      const { data: userRole } = await supabase
        .from("user_event_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("event_id", eventId)
        .maybeSingle();
      if (
        !userRole ||
        !canAccessRole(userRole.role as EventRole, EventRole.Organizer)
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const body = await request.json();
    const parsed = archiveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { action } = parsed.data;

    // Verify permission: organizer of this event OR global admin
    const { data: roleRow } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();

    let isAllowed = false;
    if (
      roleRow &&
      canAccessRole(roleRow.role as EventRole, EventRole.Organizer)
    ) {
      isAllowed = true;
    } else {
      const { data: isAdmin } = await supabase.rpc("is_admin_user", {
        user_id: user.id,
      });
      isAllowed = Boolean(isAdmin);
    }

    if (!isAllowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get current event status
    const { data: event, error: fetchError } = await supabase
      .from("events")
      .select("visibility")
      .eq("event_id", eventId)
      .maybeSingle();

    if (fetchError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Determine new visibility based on action
    let newVisibility: EventVisibility;
    if (action === "archive") {
      if (event.visibility === EventVisibility.Archived) {
        return NextResponse.json(
          { error: "Event is already archived" },
          { status: 400 }
        );
      }
      newVisibility = EventVisibility.Archived;
    } else {
      if (event.visibility !== EventVisibility.Archived) {
        return NextResponse.json(
          { error: "Event is not archived" },
          { status: 400 }
        );
      }
      // When unarchiving, default to Private visibility
      newVisibility = EventVisibility.Private;
    }

    // Update the event visibility
    const { error: updateError } = await supabase
      .from("events")
      .update({ visibility: newVisibility })
      .eq("event_id", eventId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || "Failed to update event" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      action,
      newVisibility,
    });
  } catch (error) {
    console.error("Error updating event:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
