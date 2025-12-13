import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EventRole } from "@/lib/types";
import { canAccessRole } from "@/features/user/roles/roles";
import { EMAIL_TYPES } from "@/lib/email_templates/constants";

const updateRoleSchema = z.object({
  role: z.enum([
    EventRole.Participant,
    EventRole.Mentor,
    EventRole.Judge,
    EventRole.Organizer,
  ]),
  notify: z.boolean().optional().default(false),
});

async function authorizeAndGetContext(
  _request: NextRequest,
  params: { eventId: string; userId: string }
) {
  const supabase = await createSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }

  const { eventId, userId } = params;
  if (!eventId || !userId) {
    return { error: NextResponse.json({ error: "Missing route parameters" }, { status: 400 }) } as const;
  }

  const { data: roleRow } = await supabase
    .from("user_event_roles")
    .select("role")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: isAdminRpc } = await supabase.rpc("is_admin_user", { user_id: user.id });
  const isAdmin = Boolean(isAdminRpc)

  let isAllowed = false;
  if (roleRow && canAccessRole(roleRow.role as EventRole, EventRole.Organizer)) {
    isAllowed = true;
  } else {
    isAllowed = isAdmin;
  }

  if (!isAllowed) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  }

  const { data: targetRow } = await supabase
    .from("user_event_roles")
    .select("user_id, role")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!targetRow) {
    return { error: NextResponse.json({ error: "User not found for this event" }, { status: 404 }) } as const;
  }

  const isActingOnSelf = user.id === userId;
  if (isActingOnSelf && !isAdmin) {
    return { error: NextResponse.json({ error: "You cannot modify your own role" }, { status: 403 }) } as const;
  }

  const isTargetOrganizer = (targetRow.role as EventRole) === EventRole.Organizer;
  if (isTargetOrganizer && !isAdmin) {
    return { error: NextResponse.json({ error: "Only admins can modify organizer roles" }, { status: 403 }) } as const;
  }

  return { supabase, user, isAdmin, eventId, userId, targetRow } as const;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ eventId: string; userId: string }> }
) {
  try {
    const { eventId, userId } = await context.params;
    const auth = await authorizeAndGetContext(request, { eventId, userId });
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const parsed = updateRoleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const newRole = parsed.data.role;
    const shouldNotify = parsed.data.notify === true;

    const { error: updateError } = await auth.supabase
      .from("user_event_roles")
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq("event_id", auth.eventId)
      .eq("user_id", auth.userId);

    if (updateError) {
      const message = updateError.message || "Failed to update role";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // Optionally notify the affected user about the change
    if (shouldNotify) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/email_notification/user/${auth.userId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventId: auth.eventId,
              emailType: EMAIL_TYPES.EVENT_UPDATE,
            }),
          }
        );
      } catch (e) {
        // Non-blocking: ignore failures to send email
        console.error("Failed to send notification email for role update", e);
      }
    }

    return NextResponse.json({ success: true, user_id: auth.userId, role: newRole });
  } catch (error) {
    console.error("Error updating participant role:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ eventId: string; userId: string }> }
) {
  try {
    const { eventId, userId } = await context.params;
    const auth = await authorizeAndGetContext(request, { eventId, userId });
    if ("error" in auth) return auth.error;
    const { notify } = await request.json().catch(() => ({ notify: false }));

    const { error: deleteError } = await auth.supabase
      .from("user_event_roles")
      .delete()
      .eq("event_id", auth.eventId)
      .eq("user_id", auth.userId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message || "Failed to remove user" }, { status: 400 });
    }

    if (notify === true) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/email_notification/user/${auth.userId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventId: auth.eventId,
              emailType: EMAIL_TYPES.EVENT_UPDATE,
            }),
          }
        );
      } catch (e) {
        console.error("Failed to send notification email for removal", e);
      }
    }

    return NextResponse.json({ success: true, user_id: auth.userId });
  } catch (error) {
    console.error("Error removing participant:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
