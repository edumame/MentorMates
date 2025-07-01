import { NextResponse } from "next/server";
import { EventRole, EventVisibility } from "@/lib/types";
import { createSupabaseClient } from "@/app/utils/supabase/server";

export async function GET() {
  const supabase = await createSupabaseClient();

  try {
    // Check if user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;

    // Get user's roles in all events
    const { data: userRoles, error: rolesError } = await supabase
      .from("user_event_roles")
      .select("event_id, role")
      .eq("user_id", userId);

    if (rolesError) throw rolesError;

    // Check if user is an admin
    const { data: isAdmin } = await supabase.rpc("is_admin_user", {
      user_id: userId,
    });

    // Get event IDs where user is an organizer or admin
    const organizerEventIds = userRoles
      .filter((role: any) => ["organizer", "admin"].includes(role.role))
      .map((role: any) => role.event_id);

    let query = supabase.from("events").select("*");

    if (isAdmin) {
      // Admins can see all archived events
      query = query.eq("visibility", EventVisibility.Archived);
    } else if (organizerEventIds.length > 0) {
      // Organizers can only see archived events they organized
      query = query
        .eq("visibility", EventVisibility.Archived)
        .in("event_id", organizerEventIds);
    } else {
      // Regular users cannot see archived events
      return NextResponse.json({ events: [] });
    }

    const { data: events, error: eventsError } = await query.order("event_date", { ascending: false });

    if (eventsError) throw eventsError;

    // Include user role with each event
    const eventsWithRole = events.map((event: any) => {
      const userRole =
        userRoles.find((role: any) => role.event_id === event.event_id)?.role ||
        null;
      return { ...event, userRole };
    });

    return NextResponse.json({ events: eventsWithRole });
  } catch (error) {
    console.error("Error fetching archived events:", error);
    return NextResponse.json(
      { error: "Failed to fetch archived events" },
      { status: 500 }
    );
  }
}