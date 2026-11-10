import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EventVisibility } from "@/lib/types";
import { withdrawSubmissionUpdate } from "@/lib/events/approval-visibility";
import { z } from "zod";
import { deleteEvent } from "./delete-event";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseClient>>;

/**
 * Owner, event organizer or global admin. Delegates to the SQL helper
 * public.can_manage_event() (same rule as the events UPDATE RLS policy) so the
 * API, delete_event() and the archived-events SELECT policy agree.
 */
async function canManageEvent(
  supabase: SupabaseServerClient,
  eventId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("can_manage_event", {
    p_event_id: eventId,
    p_user_id: userId,
  });
  if (error) {
    console.error("Error checking event permissions:", error);
    return false;
  }
  return data === true;
}

export async function DELETE(
  _request: NextRequest,
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

    const { eventId } = await params;
    if (!eventId) {
      return NextResponse.json(
        { error: "Event ID is required" },
        { status: 400 }
      );
    }

    // The whole delete (permission check, feedback/engagement/tracks cleanup
    // and the event row itself, with cascades) runs in one transaction inside
    // public.delete_event(), so a failure can no longer leave a half-deleted
    // event behind.
    return await deleteEvent(supabase, eventId);
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

    if (!(await canManageEvent(supabase, eventId, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsed = archiveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { action } = parsed.data;

    // Get current event status
    const { data: event, error: fetchError } = await supabase
      .from("events")
      .select("visibility, approval_status")
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

    // Update the event visibility, withdrawing any pending submission
    const withdrawal = withdrawSubmissionUpdate(
      event.approval_status,
      newVisibility,
    );
    const { data: updatedRows, error: updateError } = await supabase
      .from("events")
      .update({ visibility: newVisibility, ...withdrawal })
      .eq("event_id", eventId)
      .select("event_id");

    if (updateError) {
      console.error(`Error trying to ${action} event:`, updateError);
      return NextResponse.json(
        { error: `Failed to ${action} event` },
        { status: 500 }
      );
    }

    // RLS can silently filter the row; never report success for a no-op.
    if (!updatedRows || updatedRows.length === 0) {
      return NextResponse.json(
        { error: `You don't have permission to ${action} this event` },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      action,
      newVisibility,
      approvalStatus: withdrawal.approval_status ?? event.approval_status,
    });
  } catch (error) {
    console.error("Error updating event:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
