import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EventVisibility } from "@/lib/types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const eventId = params.id;
    const { action } = await request.json();

    if (!action || !["archive", "unarchive"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'archive' or 'unarchive'" },
        { status: 400 }
      );
    }

    // Check if user has permission to archive/unarchive this event
    const { data: userRole } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .single();

    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc("is_admin_user", {
      user_id: user.id,
    });

    if (!isAdmin && (!userRole || !["organizer", "admin"].includes(userRole.role))) {
      return NextResponse.json(
        { error: "Permission denied. Only organizers and admins can archive events." },
        { status: 403 }
      );
    }

    // Get current event to determine the action
    const { data: currentEvent, error: fetchError } = await supabase
      .from("events")
      .select("visibility")
      .eq("event_id", eventId)
      .single();

    if (fetchError) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    let newVisibility: EventVisibility;
    
    if (action === "archive") {
      // Archive the event
      newVisibility = EventVisibility.Archived;
    } else {
      // Unarchive the event - restore to public by default
      // You might want to store the previous visibility state
      newVisibility = EventVisibility.Public;
    }

    // Update the event visibility
    const { error: updateError } = await supabase
      .from("events")
      .update({ visibility: newVisibility })
      .eq("event_id", eventId);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update event visibility" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Event ${action === "archive" ? "archived" : "unarchived"} successfully`,
      visibility: newVisibility,
    });
  } catch (error) {
    console.error("Error in archive/unarchive:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}