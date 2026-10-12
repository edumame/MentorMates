import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EventVisibility } from "@/lib/types";

const updateEventStatusSchema = z.object({
  featured: z.boolean().optional(),
  approval_status: z.enum(["not_submitted", "submitted", "approved", "rejected"]).optional(),
  rejection_reason: z.string().optional(),
});

export async function PATCH(
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

    // Check if user is admin
    const { data: isAdminData } = await supabase.rpc("is_admin_user", {
      user_id: user.id,
    });

    if (!isAdminData) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const { eventId } = await params;
    const body = await request.json();
    const validation = updateEventStatusSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { featured, approval_status, rejection_reason } = validation.data;

    // Build update object with only provided fields
    const updateData: Record<string, boolean | string | null> = {};
    if (featured !== undefined) updateData.featured = featured;
    if (approval_status !== undefined) {
      updateData.approval_status = approval_status;

      if (approval_status === "approved") {
        updateData.visibility = EventVisibility.Public;
      }
      
      // If status is being set to rejected, require rejection_reason
      if (approval_status === "rejected" && !rejection_reason) {
        return NextResponse.json(
          { error: "rejection_reason is required when rejecting an event" },
          { status: 400 }
        );
      }
      
      // Set or clear rejection_reason based on status
      if (approval_status === "rejected" && rejection_reason) {
        updateData.rejection_reason = rejection_reason;
      } else if (approval_status !== "rejected") {
        // Clear rejection reason when moving away from rejected status
        updateData.rejection_reason = null;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    // If approval_status is being updated, get the current status first for logging
    let previousStatus = null;
    if (approval_status !== undefined) {
      const { data: currentEvent } = await supabase
        .from("events")
        .select("approval_status")
        .eq("event_id", eventId)
        .single();
      
      previousStatus = currentEvent?.approval_status || null;
    }

    // Update the event
    const { data, error } = await supabase
      .from("events")
      .update(updateData)
      .eq("event_id", eventId)
      .select()
      .single();

    if (error) {
      console.error("Error updating event:", error);
      return NextResponse.json(
        { error: "Failed to update event" },
        { status: 500 }
      );
    }

    // Log approval status changes
    if (approval_status !== undefined && approval_status !== previousStatus) {
      const { error: logError } = await supabase
        .from("event_approval_logs")
        .insert({
          event_id: eventId,
          admin_user_id: user.id,
          previous_status: previousStatus,
          new_status: approval_status,
          notes: null, // Can be extended to include notes in the future
          rejection_reason: approval_status === "rejected" ? rejection_reason || null : null,
        });

      if (logError) {
        console.error("Error logging approval status change:", logError);
        // Don't fail the request if logging fails, just log the error
      }
    }

    return NextResponse.json({ success: true, event: data });
  } catch (error) {
    console.error("Error in PATCH /api/admin/events/[eventId]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const supabase = await createSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: isAdminData } = await supabase.rpc("is_admin_user", {
      user_id: user.id,
    });

    if (!isAdminData) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const { eventId } = await params;

    const { error } = await supabase
      .from("events")
      .delete()
      .eq("event_id", eventId);

    if (error) {
      console.error("Error deleting event:", error);
      return NextResponse.json(
        { error: "Failed to delete event" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/admin/events/[eventId]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
