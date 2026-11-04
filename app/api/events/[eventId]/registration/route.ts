import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { releaseParticipantSeatReservation } from "@/lib/events/participant-access";

// DELETE: The signed-in user cancels their own registration
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await context.params;
    const supabase = await createSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await releaseParticipantSeatReservation(createSupabaseServiceClient(), {
      eventId,
      userId: user.id,
    });

    const { error: deleteError } = await supabase
      .from("user_event_roles")
      .delete()
      .eq("user_id", user.id)
      .eq("event_id", eventId);

    if (deleteError) {
      console.error("Error removing user role:", deleteError);
      return NextResponse.json(
        { error: "Failed to cancel registration" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error cancelling registration:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
