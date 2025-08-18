import { NextResponse } from "next/server";
import { EventRole, EventVisibility } from "@/lib/types";
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

    // First check if the event is private, which means all roles need a password
    if (
      event?.visibility === EventVisibility.Private &&
      role !== EventRole.Judge &&
      role !== EventRole.Organizer
    ) {
      if (!password) {
        return NextResponse.json(
          { error: "Password required for this event" },
          { status: 400 }
        );
      }

      // Verify role password
      const { data: rolePassword, error: rolePassError } = await supabase
        .from("role_passwords")
        .select("password_hash")
        .eq("event_id", eventId)
        .eq("role", role)
        .single();

      if (rolePassError || !rolePassword) {
        return NextResponse.json(
          { error: "No password set for this role" },
          { status: 404 }
        );
      }

      // Verify password
      const isValidRolePass = await bcrypt.compare(
        password,
        rolePassword.password_hash
      );

      if (!isValidRolePass) {
        return NextResponse.json(
          { error: "Invalid role password" },
          { status: 401 }
        );
      }
    }
    // For non-private events, check if the role itself requires a password
    else {
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
        if (role !== EventRole.Participant && role !== EventRole.Mentor) {
          return NextResponse.json({ error: "Invalid role" }, { status: 400 });
        }
      }
    }

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
