import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const supabase = await createSupabaseClient();
    const serviceSupabase = createSupabaseServiceClient();
    const { eventId } = await params;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: tickets, error } = await serviceSupabase
      .from("event_tickets")
      .select(
        `
        id,
        assigned_to_user_id,
        assigned_to_email,
        ticket_status,
        assigned_at,
        created_at,
        assigned_user:user_profiles!event_tickets_assigned_to_user_id_fkey(
          display_name,
          email
        )
      `
      )
      .eq("event_id", eventId)
      .eq("purchased_by_user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch tickets" },
        { status: 500 }
      );
    }

    return NextResponse.json({ tickets: tickets || [] });
  } catch (error) {
    console.error("Error in GET /api/events/[eventId]/my-tickets:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
