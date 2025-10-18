import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EventRole } from "@/lib/types";

// POST /api/projects/invitations/accept
// body: { invitationId?: string, projectId?: string, hash?: string }
// Accepts invite -> ensures event access -> adds to project -> returns project URL
export async function POST(request: Request) {
  const supabase = await createSupabaseClient();
  const { invitationId, projectId, hash } = await request.json();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Load user profile for email
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("uid, email")
    .eq("uid", user.id)
    .single();

  if (!profile?.email) {
    return NextResponse.json({ error: "User email not found" }, { status: 400 });
  }

  // Fetch invitation
  const { data: invite, error: inviteError } = await supabase
    .from("project_invitations")
    .select("*, projects ( id, teammates, lead_email, event_id, project_name ), events:events ( event_name )")
    .match(
      invitationId
        ? { id: invitationId }
        : { project_id: projectId, hash: hash as string }
    )
    .maybeSingle();

  if (inviteError || !invite) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  if (invite.status !== "pending") {
    return NextResponse.json({ error: "Invitation no longer valid" }, { status: 400 });
  }

  // Verify email matches hash semantics at API level by comparing normalized email
  const normalizedEmail = profile.email.toLowerCase();
  if (normalizedEmail !== invite.invited_email.toLowerCase()) {
    return NextResponse.json({ error: "This invitation is for a different email" }, { status: 403 });
  }

  // If the project belongs to an event, ensure user has event role (participant)
  const eventId: string | null = invite.projects?.event_id || invite.event_id || null;
  if (eventId) {
    const { data: role } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("event_id", eventId)
      .maybeSingle();

    if (!role) {
      // Auto-assign participant role to let them in
      await supabase.from("user_event_roles").upsert(
        {
          user_id: user.id,
          event_id: eventId,
          role: EventRole.Participant,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,event_id" }
      );
    }
  }

  // Add user to project teammates if not already present
  const currentTeammates: string[] = invite.projects?.teammates || [];
  if (!currentTeammates.includes(normalizedEmail) && normalizedEmail !== invite.projects?.lead_email) {
    const updatedTeammates = [...currentTeammates, normalizedEmail];
    const { error: updateError } = await supabase
      .from("projects")
      .update({ teammates: updatedTeammates })
      .eq("id", invite.project_id);

    if (updateError) {
      return NextResponse.json({ error: "Failed to add to project" }, { status: 500 });
    }
  }

  // Mark invitation as accepted
  await supabase
    .from("project_invitations")
    .update({ status: "accepted", accepted_at: new Date().toISOString(), invited_user_id: user.id })
    .eq("id", invite.id);

  // Mark related notification read if exists
  await supabase
    .from("notifications")
    .update({ status: "read", read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("type", "project_invite")
    .contains("data", { projectId: invite.project_id });

  const redirectUrl = `/projects/${invite.project_id}`;
  return NextResponse.json({ success: true, projectId: invite.project_id, redirectUrl });
}
