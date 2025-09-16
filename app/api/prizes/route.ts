import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EventRole } from "@/lib/types";
import { canAccessRole } from "@/features/user/roles/roles";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    if (!eventId) {
      return NextResponse.json(
        { error: "Event ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check if current user has access to this event
    const { data: currentUserRole, error: roleError } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .single();

    if (roleError || !currentUserRole || !canAccessRole(currentUserRole.role as EventRole, EventRole.Organizer)) {
      return NextResponse.json(
        { error: "Insufficient permissions. Must be an organizer." },
        { status: 403 }
      );
    }

    // Fetch prizes
    const { data: prizesData, error: prizesError } = await supabase
      .from("prizes")
      .select(
        `
        *,
        event_tracks!inner (
          event_id
        ),
        prize_winners (
          id,
          project_id,
          assigned_at,
          assigned_by,
          projects (
            id,
            project_name,
            lead_name,
            event_id
          )
        )
      `
      )
      .eq("event_tracks.event_id", eventId);

    if (prizesError) {
      return NextResponse.json(
        { error: "Failed to fetch prizes" },
        { status: 500 }
      );
    }

    // Transform prizes data to match expected structure
    const transformedPrizes = (prizesData || []).map((prize) => ({
      id: prize.id,
      track_id: prize.track_id,
      prize_amount: prize.prize_amount,
      prize_description: prize.prize_description,
      prize_winners: prize.prize_winners || null
    }));

    return NextResponse.json({ 
      prizes: transformedPrizes 
    });

  } catch (error) {
    console.error("Error fetching prizes:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prizes, eventId } = body;

    if (!prizes || !Array.isArray(prizes)) {
      return NextResponse.json(
        { error: "Prizes array is required" },
        { status: 400 }
      );
    }

    if (!eventId) {
      return NextResponse.json(
        { error: "Event ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check if current user is an organizer of this event
    const { data: currentUserRole, error: roleError } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .single();

    if (roleError || !currentUserRole || !canAccessRole(currentUserRole.role as EventRole, EventRole.Organizer)) {
      return NextResponse.json(
        { error: "Insufficient permissions. Must be an organizer." },
        { status: 403 }
      );
    }

    // Validate track IDs exist for this event
    const trackIds = [...new Set(prizes.map((prize: { track_id: string }) => prize.track_id))];
    const { data: validTracks, error: trackError } = await supabase
      .from("event_tracks")
      .select("track_id")
      .eq("event_id", eventId)
      .in("track_id", trackIds);

    if (trackError) {
      return NextResponse.json(
        { error: "Failed to validate tracks" },
        { status: 500 }
      );
    }

    const validTrackIds = new Set(validTracks?.map((t: { track_id: string }) => t.track_id) || []);
    const invalidTracks = trackIds.filter(id => !validTrackIds.has(id));

    if (invalidTracks.length > 0) {
      return NextResponse.json(
        { error: `Invalid track IDs: ${invalidTracks.join(", ")}` },
        { status: 400 }
      );
    }

    // Prepare prizes for upsert
    const prizesToUpsert = prizes.map((prize: { id: string; track_id: string; prize_amount?: string; prize_description?: string }) => ({
      id: prize.id,
      track_id: prize.track_id,
      prize_amount: prize.prize_amount || "",
      prize_description: prize.prize_description || "",
      updated_at: new Date().toISOString(),
    }));

    // Perform upsert operation
    const { data: upsertedPrizes, error: upsertError } = await supabase
      .from("prizes")
      .upsert(prizesToUpsert, {
        onConflict: "id",
      })
      .select();

    if (upsertError) {
      return NextResponse.json(
        { error: "Failed to save prizes" },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: "Prizes saved successfully",
      prizes: upsertedPrizes 
    });

  } catch (error) {
    console.error("Error saving prizes:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const prizeId = searchParams.get("prizeId");

    if (!prizeId) {
      return NextResponse.json(
        { error: "Prize ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get prize details to find the track and event
    const { data: prize, error: prizeError } = await supabase
      .from("prizes")
      .select(`
        id,
        track_id,
        event_tracks!inner(event_id)
      `)
      .eq("id", prizeId)
      .single()
      .overrideTypes<{
        id: string;
        track_id: string;
        event_tracks: {
          event_id: string;
        };
      }>();

    if (prizeError || !prize) {
      return NextResponse.json(
        { error: "Prize not found" },
        { status: 404 }
      );
    }

    const eventId = prize.event_tracks.event_id;

    // Check if current user is an organizer of this event
    const { data: currentUserRole, error: roleError } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .single();

    if (roleError || !currentUserRole || !canAccessRole(currentUserRole.role as EventRole, EventRole.Organizer)) {
      return NextResponse.json(
        { error: "Insufficient permissions. Must be an organizer." },
        { status: 403 }
      );
    }

    // Delete the prize
    const { error: deleteError } = await supabase
      .from("prizes")
      .delete()
      .eq("id", prizeId);

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to delete prize" },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: "Prize deleted successfully" 
    });

  } catch (error) {
    console.error("Error deleting prize:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}