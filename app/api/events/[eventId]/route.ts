import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EventRole } from "@/lib/types";
import { canAccessRole } from "@/features/user/roles/roles";

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
      return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
    }

    // Verify permission: organizer of this event OR global admin
    const { data: roleRow } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();

    let isAllowed = false;
    if (roleRow && canAccessRole(roleRow.role as EventRole, EventRole.Organizer)) {
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
    // 1) Delete event_tickets (FK -> user_event_payments, user_profiles) by event_id
    await supabase.from("event_tickets").delete().eq("event_id", eventId);

    // 2) Delete user_event_payments for this event
    await supabase.from("user_event_payments").delete().eq("event_id", eventId);

    // 3) Delete prize winners and prizes via event_tracks join
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

