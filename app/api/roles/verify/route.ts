import { NextResponse } from "next/server";
import { EventRole } from "@/lib/types";
import * as bcrypt from "bcrypt";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { joinParticipantEvent } from "@/lib/events/participant-access";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { canAccessRole } from "@/features/user/roles/roles";
import { isPasswordJoinableRole, PASSWORD_REQUIRED_ROLES } from "@/lib/roles/role-passwords";

export async function POST(request: Request) {
  const supabase = await createSupabaseClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;
    const body = await request.json().catch(() => null);
    const eventId = body?.eventId;
    const role = body?.role;
    const password = body?.password;

    if (typeof eventId !== "string" || !eventId || typeof role !== "string" || !role) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Organizer (and admin) access is only granted by invitation (ORG-013).
    if (!isPasswordJoinableRole(role)) {
      return NextResponse.json(
        { error: role === EventRole.Organizer
            ? "Organizers are added by invitation from an existing organizer"
            : "Invalid role specified" },
        { status: role === EventRole.Organizer ? 403 : 400 }
      );
    }
    const requestedRole: EventRole = role;

    const { data: event, error: eventError } = await supabase
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

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const serviceSupabase = createSupabaseServiceClient();

    // MENT-017: this endpoint never changes an existing role. An existing
    // member can only move up to a staff role with that role's password; it
    // never downgrades anyone (e.g. an organizer picking "Mentor").
    const { data: existingRole, error: existingRoleError } = await serviceSupabase
      .from("user_event_roles")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingRoleError) {
      return NextResponse.json(
        { error: "Failed to check event registration" },
        { status: 500 }
      );
    }

    if (existingRole && canAccessRole(existingRole.role as EventRole, requestedRole)) {
      return NextResponse.json(
        {
          error: `You are already registered for this event as ${existingRole.role}.`,
          role: existingRole.role,
        },
        { status: 409 }
      );
    }

    // Hashes are never readable by the browser; authenticate and check event
    // visibility before using the server-only verifier.
    const { data: rolePassword, error: rolePasswordError } = await serviceSupabase
      .from("role_passwords")
      .select("password_hash")
      .eq("event_id", eventId)
      .eq("role", requestedRole)
      .maybeSingle();

    if (rolePasswordError) {
      return NextResponse.json(
        { error: "Failed to verify role password" },
        { status: 500 }
      );
    }

    if (!rolePassword && PASSWORD_REQUIRED_ROLES.includes(requestedRole)) {
      return NextResponse.json(
        { error: "This role requires an invitation from an event organizer" },
        { status: 403 }
      );
    }

    if (rolePassword) {
      if (typeof password !== "string" || !password) {
        return NextResponse.json(
          { error: "Password required for this role" },
          { status: 400 }
        );
      }

      // ORG-013: the attempt is counted atomically BEFORE the password is
      // compared (per user and per event+role), so parallel requests cannot
      // exceed the budget; a correct password refunds it.
      const throttleArgs = {
        p_user_id: userId,
        p_event_id: eventId,
        p_role: requestedRole,
      };
      const { data: attempt, error: attemptError } = await serviceSupabase.rpc(
        "consume_role_password_attempt",
        throttleArgs
      );
      const verdict = Array.isArray(attempt) ? attempt[0] : attempt;
      if (attemptError || !verdict) {
        return NextResponse.json(
          { error: "Failed to verify role password" },
          { status: 500 }
        );
      }
      if (!verdict.allowed) return tooManyAttempts(verdict.retry_at);

      const isValid = await bcrypt.compare(password, rolePassword.password_hash);

      if (!isValid) {
        return NextResponse.json(
          { error: "Invalid password" },
          { status: 401 }
        );
      }

      await serviceSupabase.rpc("clear_role_password_failures", throttleArgs);
    }

    // Every check above has passed, so writes use the service client.
    if (requestedRole === EventRole.Participant) {
      const joinResult = await joinParticipantEvent(serviceSupabase, {
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

    const roleWrite = existingRole
      ? serviceSupabase
          .from("user_event_roles")
          .update({ role: requestedRole, updated_at: new Date().toISOString() })
          .eq("event_id", eventId)
          .eq("user_id", userId)
          // Guard against a concurrent change since the read above.
          .eq("role", existingRole.role)
      : serviceSupabase.from("user_event_roles").insert({
          user_id: userId,
          event_id: eventId,
          role: requestedRole,
          updated_at: new Date().toISOString(),
        });

    const { error: roleError } = await roleWrite;

    if (roleError) {
      if (roleError.code === "23505") {
        return NextResponse.json(
          { error: "You are already registered for this event." },
          { status: 409 }
        );
      }
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

function tooManyAttempts(lockedUntil: string | null) {
  const retryAfterSeconds = lockedUntil
    ? Math.max(1, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 1000))
    : 60;
  return NextResponse.json(
    {
      error: "Too many incorrect password attempts. Please try again later.",
      retry_after_seconds: retryAfterSeconds,
    },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}
