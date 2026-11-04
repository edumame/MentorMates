import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { canAccessRole } from "@/features/user/roles/roles";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EventRole } from "@/lib/types";
import { verifyEventRoleInviteToken } from "@/lib/utils/jwt";

const INVALID_INVITE_MESSAGE =
  "This invitation link is invalid or has expired. Please ask the event organizer for a new one.";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const token = body?.token;
  const invite =
    typeof token === "string" && token
      ? await verifyEventRoleInviteToken(token)
      : null;

  if (!invite || invite.eventId !== eventId) {
    return NextResponse.json({ error: INVALID_INVITE_MESSAGE }, { status: 403 });
  }

  if (invite.email !== user.email.toLowerCase()) {
    return NextResponse.json(
      { error: `This invitation was sent to ${invite.email}.` },
      { status: 403 }
    );
  }

  const service = createSupabaseServiceClient();
  const { data: existingRole, error: lookupError } = await service
    .from("user_event_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("event_id", eventId)
    .maybeSingle();

  if (lookupError) {
    console.error("Error loading event role:", lookupError);
    return NextResponse.json(
      { error: "Failed to accept invitation" },
      { status: 500 }
    );
  }

  // Accepting an invite must never downgrade someone who already has more access.
  const inviteRole = invite.role as EventRole;
  if (
    existingRole &&
    canAccessRole(existingRole.role as EventRole, inviteRole)
  ) {
    return NextResponse.json({ success: true });
  }

  const { error: roleError } = await service.from("user_event_roles").upsert(
    {
      user_id: user.id,
      event_id: eventId,
      role: inviteRole,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,event_id" }
  );

  if (roleError) {
    console.error("Error accepting event invite:", roleError);
    return NextResponse.json(
      { error: "Failed to accept invitation" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
