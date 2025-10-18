import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";

// GET /api/projects/invitations - list pending invitations for current user (by id or email)
export async function GET() {
  const supabase = await createSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Resolve user email
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("email")
    .eq("uid", user.id)
    .maybeSingle();

  const email = profile?.email?.toLowerCase() || null;

  // Return invites where the user is either linked or invited by email
  const { data: invites, error } = await supabase
    .from("project_invitations")
    .select(
      `
      id,
      project_id,
      event_id,
      invited_email,
      invited_user_id,
      status,
      created_at,
      hash,
      projects ( id, project_name, project_description, event_id ),
      events:events ( event_name )
    `
    )
    .or(
      [
        `invited_user_id.eq.${user.id}`,
        email ? `invited_email.eq.${email}` : "invited_email.eq.__none__",
      ].join(",")
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch invites" }, { status: 500 });
  }

  return NextResponse.json({ invites });
}
