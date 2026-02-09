import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EventRole, ParticipantRequestStatus } from "@/lib/types";
import { canAccessRole } from "@/features/user/roles/roles";

const updateRequestSchema = z.object({
  status: z.enum([
    ParticipantRequestStatus.Approved,
    ParticipantRequestStatus.Rejected,
  ]),
  rejection_reason: z.string().max(1000).optional(),
});

// GET: Get single request details
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ eventId: string; requestId: string }> }
) {
  try {
    const { eventId, requestId } = await context.params;
    const supabase = await createSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the request
    const { data: approvalRequest, error: queryError } = await supabase
      .from("participant_approval_requests")
      .select(
        `
        *,
        user_profile:user_profiles!participant_approval_requests_user_id_fkey(
          uid,
          display_name,
          email,
          avatar_url
        ),
        reviewer_profile:user_profiles!participant_approval_requests_reviewed_by_fkey(
          uid,
          display_name
        )
      `
      )
      .eq("id", requestId)
      .eq("event_id", eventId)
      .single();

    if (queryError || !approvalRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Check if user can view this request (either their own or organizer/admin)
    const isOwner = approvalRequest.user_id === user.id;

    if (!isOwner) {
      const { data: roleRow } = await supabase
        .from("user_event_roles")
        .select("role")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .maybeSingle();

      const { data: isAdminRpc } = await supabase.rpc("is_admin_user", {
        user_id: user.id,
      });
      const isAdmin = Boolean(isAdminRpc);
      const isOrganizer =
        roleRow &&
        canAccessRole(roleRow.role as EventRole, EventRole.Organizer);

      if (!isOrganizer && !isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json({ request: approvalRequest });
  } catch (error) {
    console.error("Error fetching approval request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH: Update request status (approve/reject) - organizers only
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ eventId: string; requestId: string }> }
) {
  try {
    const { eventId, requestId } = await context.params;
    const supabase = await createSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is organizer/admin for this event
    const { data: roleRow } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: isAdminRpc } = await supabase.rpc("is_admin_user", {
      user_id: user.id,
    });
    const isAdmin = Boolean(isAdminRpc);
    const isOrganizer =
      roleRow && canAccessRole(roleRow.role as EventRole, EventRole.Organizer);

    if (!isOrganizer && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const parsed = updateRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { status, rejection_reason } = parsed.data;

    // Fetch the current request
    const { data: approvalRequest, error: queryError } = await supabase
      .from("participant_approval_requests")
      .select("*")
      .eq("id", requestId)
      .eq("event_id", eventId)
      .single();

    if (queryError || !approvalRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Check state transitions
    const currentStatus = approvalRequest.status;
    
    // If rejecting an approved user, remove their role from the event
    if (currentStatus === ParticipantRequestStatus.Approved && status === ParticipantRequestStatus.Rejected) {
      const { error: deleteRoleError } = await supabase
        .from("user_event_roles")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", approvalRequest.user_id)
        .eq("role", approvalRequest.requested_role);

      if (deleteRoleError) {
        console.error("Error removing user role:", deleteRoleError);
        return NextResponse.json(
          { error: "Failed to revoke user access to event" },
          { status: 500 }
        );
      }
    }

    // If approving, check capacity first
    if (status === ParticipantRequestStatus.Approved) {
      const { data: event } = await supabase
        .from("events")
        .select("participant_capacity")
        .eq("event_id", eventId)
        .single();

      if (
        event?.participant_capacity &&
        approvalRequest.requested_role === "participant"
      ) {
        const { count: participantCount } = await supabase
          .from("user_event_roles")
          .select("*", { count: "exact", head: true })
          .eq("event_id", eventId)
          .eq("role", "participant");

        if (
          participantCount &&
          participantCount >= event.participant_capacity
        ) {
          return NextResponse.json(
            { error: "Event is at full capacity. Cannot approve more participants." },
            { status: 409 }
          );
        }
      }
    }

    // Update the request status
    const { error: updateError } = await supabase
      .from("participant_approval_requests")
      .update({
        status,
        rejection_reason:
          status === ParticipantRequestStatus.Rejected
            ? rejection_reason || null
            : null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (updateError) {
      console.error("Error updating approval request:", updateError);
      return NextResponse.json(
        { error: "Failed to update request" },
        { status: 500 }
      );
    }

    // If approved, create the user_event_role entry (if not already exists)
    if (status === ParticipantRequestStatus.Approved) {
      // Check if role already exists (in case of re-approval)
      const { data: existingRole } = await supabase
        .from("user_event_roles")
        .select("*")
        .eq("event_id", eventId)
        .eq("user_id", approvalRequest.user_id)
        .eq("role", approvalRequest.requested_role)
        .maybeSingle();

      if (!existingRole) {
        const { error: roleError } = await supabase
          .from("user_event_roles")
          .insert({
            event_id: eventId,
            user_id: approvalRequest.user_id,
            role: approvalRequest.requested_role,
          });

        if (roleError) {
          // If role creation fails, revert the request status
          await supabase
            .from("participant_approval_requests")
            .update({
              status: currentStatus,
              reviewed_by: null,
              reviewed_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", requestId);

          console.error("Error creating user role:", roleError);
          return NextResponse.json(
            { error: "Failed to assign role to user" },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      status,
      message:
        status === ParticipantRequestStatus.Approved
          ? "Request approved. User has been added to the event."
          : "Request rejected.",
    });
  } catch (error) {
    console.error("Error updating approval request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE: Withdraw request (user can only withdraw their own pending request)
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ eventId: string; requestId: string }> }
) {
  try {
    const { eventId, requestId } = await context.params;
    const supabase = await createSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the request
    const { data: approvalRequest, error: queryError } = await supabase
      .from("participant_approval_requests")
      .select("*")
      .eq("id", requestId)
      .eq("event_id", eventId)
      .single();

    if (queryError || !approvalRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Only the request owner can withdraw
    if (approvalRequest.user_id !== user.id) {
      return NextResponse.json(
        { error: "You can only withdraw your own requests" },
        { status: 403 }
      );
    }

    // Can only withdraw pending requests
    if (approvalRequest.status !== "pending") {
      return NextResponse.json(
        { error: "Can only withdraw pending requests" },
        { status: 400 }
      );
    }

    // Update status to withdrawn
    const { error: updateError } = await supabase
      .from("participant_approval_requests")
      .update({
        status: "withdrawn",
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (updateError) {
      console.error("Error withdrawing request:", updateError);
      return NextResponse.json(
        { error: "Failed to withdraw request" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Request withdrawn successfully",
    });
  } catch (error) {
    console.error("Error withdrawing approval request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
