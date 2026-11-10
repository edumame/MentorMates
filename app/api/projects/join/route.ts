import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { verifyProjectInviteToken } from "@/lib/utils/jwt";
import { z } from "zod";
const schema = z.object({ projectId: z.string().uuid(), token: z.string().min(1).max(8192) });

export async function PUT(request: NextRequest) {
  const supabase = await createSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Project and invitation token are required" }, { status: 400 });
  const { projectId, token } = parsed.data;
  const invitation = await verifyProjectInviteToken(token);
  if (!invitation || invitation.projectId !== projectId ||
      (invitation.email && invitation.email.trim().toLowerCase() !== user.email.trim().toLowerCase())) {
    return NextResponse.json({ error: "Invalid, expired, or mismatched invitation" }, { status: 403 });
  }
  // Empty email is an intentional signed, shareable invite. The database still
  // verifies the inviter's current membership and the recipient's event access.
  const { data, error } = await createSupabaseServiceClient().rpc("accept_project_invitation", {
    p_project_id: projectId, p_user_id: user.id, p_invited_by: invitation.invitedBy,
  });
  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 500;
    return NextResponse.json({ error: status === 500 ? "Failed to join project" : error.message }, { status });
  }
  return NextResponse.json(data);
}
