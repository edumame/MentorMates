import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EventRole } from "@/lib/types";
import { canAccessRole } from "@/features/user/roles/roles";
import { EMAIL_TYPES } from "@/lib/email_templates/constants";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { sendUserEventEmail } from "@/lib/email/send-user-event-email";

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

/**
 * GET: what changing/removing this member affects (JUDGE-017). Lets the People
 * tab warn before demoting or removing a judge who has submitted scores.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ eventId: string; userId: string }> }
) {
  try {
    const { eventId, userId } = await context.params;
    const auth = await authorizeAndGetContext(request, { eventId, userId });
    if ("error" in auth) return auth.error;

    let judgeScoreCount = 0;
    if (auth.targetRow.role === EventRole.Judge) {
      const { count, error } = await createSupabaseServiceClient()
        .from("project_scores")
        .select("id", { count: "exact", head: true })
        .eq("event_id", auth.eventId)
        .eq("judge_id", auth.userId);
      if (error) {
        console.error("Failed to count judge scores:", error.code);
        return NextResponse.json({ error: "Failed to load member details" }, { status: 500 });
      }
      judgeScoreCount = count ?? 0;
    }

    return NextResponse.json({
      user_id: auth.userId,
      role: auth.targetRow.role,
      judgeScoreCount,
    });
  } catch (error) {
    console.error("Error loading participant details:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
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

    // Organizers are added through the invitation flow so the invitee consents
    // (ORG-012); only admins can grant the organizer role directly.
    if (newRole === EventRole.Organizer && !auth.isAdmin) {
      return NextResponse.json(
        { error: "Invite organizers from Access > Invite Organizers" },
        { status: 403 }
      );
    }

    const { data: updatedRows, error: updateError } = await auth.supabase
      .from("user_event_roles")
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq("event_id", auth.eventId)
      .eq("user_id", auth.userId)
      .select("user_id");

    if (updateError) return roleWriteErrorResponse(updateError, "Failed to update role");
    if (!updatedRows || updatedRows.length === 0) {
      return NextResponse.json(
        { error: "You do not have permission to change this role" },
        { status: 403 }
      );
    }

    // Judge assignment cleanup on demotion is handled in the database
    // (lane A1 migration 202611080104); submitted scores are kept.
    const service = createSupabaseServiceClient();

    const notified = shouldNotify
      ? await notifyMember(service, auth.eventId, auth.userId, "role update")
      : false;

    return NextResponse.json({
      success: true,
      user_id: auth.userId,
      role: newRole,
      notified,
    });
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

    // ORG-008: removal and its cleanup run in one transaction
    // (public.remove_event_member, service role only, called after the
    // organizer/target checks above):
    // - the role row is deleted (last-organizer guard still applies);
    // - team memberships in this event are removed; if they led a team, the
    //   longest-standing remaining member becomes lead;
    // - an approved participant request is closed so the user cannot rejoin an
    //   approval-gated event without a new organizer decision.
    // Judge assignments are cleaned up by the database (lane A1 migration
    // 202611080104). Submitted scores and intake answers are kept.
    const service = createSupabaseServiceClient();
    const { data: cleanup, error: removeError } = await service.rpc("remove_event_member", {
      p_event_id: auth.eventId,
      p_user_id: auth.userId,
      p_actor_id: auth.user.id,
    });

    if (removeError) return roleWriteErrorResponse(removeError, "Failed to remove user");
    if (!cleanup) {
      return NextResponse.json({ error: "User not found for this event" }, { status: 404 });
    }

    const notified =
      notify === true
        ? await notifyMember(service, auth.eventId, auth.userId, "removal")
        : false;

    return NextResponse.json({
      success: true,
      user_id: auth.userId,
      notified,
      ...(cleanup as Record<string, number>),
    });
  } catch (error) {
    console.error("Error removing participant:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

type ServiceClient = ReturnType<typeof createSupabaseServiceClient>;

function roleWriteErrorResponse(
  error: { code?: string; hint?: string | null; message?: string },
  fallback: string
) {
  if (error.hint === "last_organizer") {
    return NextResponse.json(
      { error: "An event must keep at least one organizer." },
      { status: 409 }
    );
  }
  if (error.code === "42501") {
    return NextResponse.json(
      { error: "You do not have permission to change this role" },
      { status: 403 }
    );
  }
  console.error(fallback, error.code);
  return NextResponse.json({ error: fallback }, { status: 400 });
}

async function notifyMember(
  service: ServiceClient,
  eventId: string,
  userId: string,
  reason: "role update" | "removal"
): Promise<boolean> {
  // For removals the membership row is already gone; authorizeAndGetContext
  // verified it before the delete.
  const result = await sendUserEventEmail({
    service,
    eventId,
    userId,
    emailType:
      reason === "removal" ? EMAIL_TYPES.EVENT_MEMBER_REMOVED : EMAIL_TYPES.EVENT_ROLE_CHANGED,
    membershipAlreadyVerified: reason === "removal",
  });
  if (!result.ok) {
    console.error(`Failed to send ${reason} notification email:`, result.status, result.error);
  }
  return result.ok;
}
