import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { InvitationStatus } from "@/features/invitations/types";
import { inngest } from "@/lib/inngest/client";

/**
 * POST /api/events/[eventId]/invitations/[id]/resend
 *
 * Resend an invitation email (for sent or expired invitations)
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ eventId: string; id: string }> }
) {
  try {
    const supabase = await createSupabaseClient();
    const { eventId, id } = await context.params;

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is organizer or admin for this event
    const { data: userRole } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: isAdmin } = await supabase.rpc("is_admin_user", {
      user_id: user.id,
    });

    const isOrganizer =
      userRole?.role === "organizer" || userRole?.role === "admin";
    if (!isOrganizer && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch the invitation
    const { data: invitation, error: queryError } = await supabase
      .from("event_invitations")
      .select("*")
      .eq("id", id)
      .eq("event_id", eventId)
      .single();

    if (queryError || !invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    // Only allow resending for certain statuses
    const resendableStatuses: string[] = [
      InvitationStatus.SENT,
      InvitationStatus.EXPIRED,
      InvitationStatus.BOUNCED,
    ];
    if (!resendableStatuses.includes(invitation.status)) {
      return NextResponse.json(
        { error: `Cannot resend invitation with status: ${invitation.status}` },
        { status: 400 }
      );
    }

    // Generate a new token and reset expiry
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7); // 7 days from now

    // Update the invitation - set to approved so it can be sent
    const { error: updateError } = await supabase
      .from("event_invitations")
      .update({
        status: InvitationStatus.APPROVED,
        expires_at: newExpiresAt.toISOString(),
        invite_token: crypto.randomUUID(),
      })
      .eq("id", id)
      .eq("event_id", eventId);

    if (updateError) {
      console.error("Error updating invitation for resend:", updateError);
      return NextResponse.json(
        { error: "Failed to prepare invitation for resend" },
        { status: 500 }
      );
    }

    // Trigger sending via Inngest
    try {
      await inngest.send({
        name: "invitation/send.batch",
        data: {
          eventId,
          invitationIds: [id],
        },
      });
    } catch (inngestError) {
      console.error("Error triggering Inngest for resend:", inngestError);
      // Don't fail the request, the invitation is already approved
    }

    return NextResponse.json({
      success: true,
      message: "Invitation queued for resending",
      newExpiresAt: newExpiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Error resending invitation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
