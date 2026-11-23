import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { releaseParticipantSeatReservation } from "@/lib/events/participant-access";
import { EventRole } from "@/lib/types";

const cancelRegistrationSchema = z.object({
  role: z.nativeEnum(EventRole),
});

// DELETE: The signed-in user cancels their own registration for one role.
// A server route because leaving a paid event also has to free the seat held
// by their approved request, which RLS does not let the user change.
export async function DELETE(
  request: NextRequest,
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

    const parsed = cancelRegistrationSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "A valid role is required" }, { status: 400 });
    }
    const { role } = parsed.data;

    if (role === EventRole.Participant) {
      await releaseParticipantSeatReservation(createSupabaseServiceClient(), {
        eventId,
        userId: user.id,
      });
    }

    // Only the role the page was rendered for is removed, through the user's
    // own client so RLS and the last-organizer guard still apply (EVT-ORG-001).
    const { error: deleteError } = await supabase
      .from("user_event_roles")
      .delete()
      .eq("user_id", user.id)
      .eq("event_id", eventId)
      .eq("role", role);

    if (deleteError) {
      console.error("Error removing user role:", deleteError);
      return NextResponse.json(
        { error: "Failed to cancel registration", hint: deleteError.hint ?? null },
        { status: 400 }
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
