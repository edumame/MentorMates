import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const supabase = await createSupabaseClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { eventId } = await params;

    // Check if user is admin or event organizer
    const { data: isAdminData } = await supabase.rpc("is_admin_user", {
      user_id: user.id,
    });

    // Check if user is the event organizer
    const { data: eventData } = await supabase
      .from("events")
      .select("owner_id")
      .eq("event_id", eventId)
      .single();

    const isOrganizer = eventData?.owner_id === user.id;

    if (!isAdminData && !isOrganizer) {
      return NextResponse.json(
        { error: "Forbidden - Admin or organizer access required" },
        { status: 403 }
      );
    }

    // Fetch approval logs with admin details
    const { data: logs, error } = await supabase
      .from("event_approval_logs")
      .select(`
        log_id,
        event_id,
        admin_user_id,
        previous_status,
        new_status,
        notes,
        created_at
      `)
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching approval logs:", error);
      return NextResponse.json(
        { error: "Failed to fetch approval logs" },
        { status: 500 }
      );
    }

    // Fetch admin details for each log
    const logsWithAdminDetails = await Promise.all(
      (logs || []).map(async (log) => {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("display_name, email")
          .eq("user_id", log.admin_user_id)
          .single();

        return {
          ...log,
          admin_name: profile?.display_name || "Unknown Admin",
          admin_email: profile?.email || null,
        };
      })
    );

    return NextResponse.json({ logs: logsWithAdminDetails });
  } catch (error) {
    console.error("Error in GET /api/admin/events/[eventId]/logs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
