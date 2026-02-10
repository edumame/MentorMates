import { NextResponse } from "next/server";
import { EventRole } from "@/lib/types";
import * as bcrypt from "bcrypt";
import { createSupabaseClient } from "@/app/utils/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseClient();

  try {
    // Get request data
    const { eventId, role, password, userId } = await request.json();

    // Input validation
    if (!eventId || !role || !userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate role is a valid EventRole value
    const validRoles = [
      EventRole.Participant, 
      EventRole.Mentor, 
      EventRole.Judge, 
      EventRole.Organizer, 
      EventRole.Admin
    ];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role specified" },
        { status: 400 }
      );
    }

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle();

    if (eventError) {
      return NextResponse.json(
        { error: "Failed to fetch event" },
        { status: 500 }
      );
    }

    // For all events, check if the role itself requires a password. Remove private password requirement.
    
      const isProtectedRole =
        role === EventRole.Judge || role === EventRole.Organizer;

      if (isProtectedRole) {
        if (!password) {
          return NextResponse.json(
            { error: "Password required for this role" },
            { status: 400 }
          );
        }

        // Get the stored password hash
        const { data: rolePassword, error: fetchError } = await supabase
          .from("role_passwords")
          .select("password_hash")
          .eq("event_id", eventId)
          .eq("role", role)
          .single();

        if (fetchError || !rolePassword) {
          return NextResponse.json(
            { error: "No password set for this role" },
            { status: 404 }
          );
        }

        // Verify password
        const isValid = await bcrypt.compare(
          password,
          rolePassword.password_hash
        );

        if (!isValid) {
          return NextResponse.json(
            { error: "Invalid password" },
            { status: 401 }
          );
        }
      } else {
        // For non-protected roles (Participant or Mentor), verify the role is valid
        const validRoles = [EventRole.Participant, EventRole.Mentor];
        if (!validRoles.includes(role)) {
          return NextResponse.json({ error: "Invalid role" }, { status: 400 });
        }
      }

    // At this point, either:
    // 1. It's a protected role and the role password was verified
    // 2. It's a non-protected role
    // Enforce participant capacity if set

    if (role === EventRole.Participant && event?.participant_capacity != null) {
      // Count current participants for this event
      const { count, error: countError } = await supabase
        .from("user_event_roles")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("role", EventRole.Participant);

      if (countError) {
        return NextResponse.json(
          { error: "Failed to check capacity" },
          { status: 500 }
        );
      }

      if ((count || 0) >= event.participant_capacity) {
        return NextResponse.json(
          { error: "Event is full. No seats available." },
          { status: 409 }
        );
      }
    }

    // Check if participant approval is required for this event and role
    if (role === EventRole.Participant && event?.require_participant_approval) {
      // Check if user has any existing approval request
      const { data: existingRequest } = await supabase
        .from("participant_approval_requests")
        .select("id, status")
        .eq("event_id", eventId)
        .eq("user_id", userId)
        .eq("requested_role", role)
        .maybeSingle();

      // If there's an approved request and event is paid, allow role creation (post-payment)
      if (existingRequest?.status === "approved" && event?.paid) {
        // Check if user has paid
        const { data: payment } = await supabase
          .from("user_event_payments")
          .select("payment_status")
          .eq("user_id", userId)
          .eq("event_id", eventId)
          .eq("payment_status", "paid")
          .maybeSingle();

        if (!payment) {
          return NextResponse.json(
            {
              error: "Payment required. Your request has been approved, but payment is still needed.",
              requires_approval: false,
              request_status: "approved_pending_payment"
            },
            { status: 402 }
          );
        }

        // Payment confirmed, proceed with role assignment below
        // Fall through to role assignment logic
      } else if (existingRequest?.status === "pending") {
        return NextResponse.json(
          {
            error: "You already have a pending request for this event",
            requires_approval: true,
            request_status: "pending"
          },
          { status: 409 }
        );
      } else if (existingRequest?.status === "approved" && !event?.paid) {
        // For non-paid events with approved request, proceed with role assignment
        // Fall through to role assignment logic
      } else if (!existingRequest) {
        // No existing request, create a new one
        const { data: newRequest, error: requestError } = await supabase
          .from("participant_approval_requests")
          .insert({
            event_id: eventId,
            user_id: userId,
            requested_role: role,
            status: "pending",
          })
          .select()
          .single();

        if (requestError) {
          console.error("Error creating approval request:", requestError);
          return NextResponse.json(
            { error: "Failed to submit approval request" },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          requires_approval: true,
          request_id: newRequest.id,
          message: "Your request has been submitted and is pending organizer approval",
        });
      } else {
        // Request exists but is rejected or withdrawn
        return NextResponse.json(
          {
            error: "Your previous request was not approved. Please contact the organizers.",
            requires_approval: false,
            request_status: existingRequest.status
          },
          { status: 403 }
        );
      }
    }

    // Now we can proceed with role assignment
    // Assign role to user
    const { error: roleError } = await supabase.from("user_event_roles").upsert(
      {
        user_id: userId,
        event_id: eventId,
        role: role,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,event_id",
      }
    );

    if (roleError) {
      return NextResponse.json(
        { error: "Failed to assign role" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Role assigned successfully",
    });
  } catch (error) {
    console.error("Error in role verification:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
