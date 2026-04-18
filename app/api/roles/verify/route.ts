import { NextResponse } from "next/server";
import { EventRole } from "@/lib/types";
import * as bcrypt from "bcrypt";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { joinParticipantEvent } from "@/lib/events/participant-access";

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

    const { error: eventError } = await supabase
      .from("events")
      .select("event_id")
      .eq("event_id", eventId)
      .maybeSingle();

    if (eventError) {
      return NextResponse.json(
        { error: "Failed to fetch event" },
        { status: 500 }
      );
    }

    // If this role has a configured password, require and verify it.
    const { data: rolePassword, error: rolePasswordError } = await supabase
      .from("role_passwords")
      .select("password_hash")
      .eq("event_id", eventId)
      .eq("role", role)
      .maybeSingle();

    if (rolePasswordError) {
      return NextResponse.json(
        { error: "Failed to verify role password" },
        { status: 500 }
      );
    }

    if (rolePassword) {
      if (!password) {
        return NextResponse.json(
          { error: "Password required for this role" },
          { status: 400 }
        );
      }

      const isValid = await bcrypt.compare(password, rolePassword.password_hash);

      if (!isValid) {
        return NextResponse.json(
          { error: "Invalid password" },
          { status: 401 }
        );
      }
    }

    // At this point, either:
    // 1. This role has a configured password and it was verified
    // 2. No password is configured for this role
    if (role === EventRole.Participant) {
      const joinResult = await joinParticipantEvent(supabase, {
        eventId,
        userId,
        channel: "web",
      });

      if (joinResult.status === "error") {
        return NextResponse.json(joinResult.payload, { status: joinResult.httpStatus });
      }

      return NextResponse.json({
        success: true,
        requires_approval: joinResult.requiresApproval,
        request_id: joinResult.requestId,
        request_status: joinResult.requestStatus,
        message: joinResult.message,
      });
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
