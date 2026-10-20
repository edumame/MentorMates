import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EventRole } from "@/lib/types";

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

export async function PUT(request: Request, { params }: RouteParams) {
  const supabase = await createSupabaseClient();
  const { eventId } = await params;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { bucket_id } = body;

    // Check if user has permission to modify this event
    const { data: userRole, error: roleError } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("event_id", eventId)
      .single();

    if (roleError && roleError.code !== "PGRST116") throw roleError;

    const hasEventAccess = userRole && [EventRole.Organizer, EventRole.Admin].includes(userRole.role);

    if (!hasEventAccess) {
      return NextResponse.json(
        { error: "Insufficient permissions to modify this event" },
        { status: 403 }
      );
    }

    // If bucket_id is provided, check if user has write access to the bucket
    if (bucket_id) {
      const { data: hasWriteAccess, error: bucketAccessError } = await supabase
        .rpc("check_bucket_access", {
          bucket_id_param: bucket_id,
          user_id_param: user.id,
          required_permission: "write"
        });

      if (bucketAccessError) throw bucketAccessError;

      if (!hasWriteAccess) {
        return NextResponse.json(
          { error: "Insufficient permissions to add events to this bucket" },
          { status: 403 }
        );
      }
    }

    // Update the event's bucket assignment
    const { data: event, error } = await supabase
      .from("events")
      .update({ bucket_id })
      .eq("event_id", eventId)
      .select(`
        event_id,
        event_name,
        bucket_id,
        event_buckets(
          bucket_id,
          bucket_name,
          bucket_slug,
          bucket_color,
          bucket_icon
        )
      `)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Event not found" },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ 
      event,
      message: bucket_id ? "Event assigned to bucket successfully" : "Event removed from bucket successfully"
    });
  } catch (error) {
    console.error("Error updating event bucket:", error);
    return NextResponse.json(
      { error: "Failed to update event bucket" },
      { status: 500 }
    );
  }
}