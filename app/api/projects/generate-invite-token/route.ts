import { createSupabaseClient } from "@/app/utils/supabase/server";
import { generateProjectInviteToken } from "@/lib/utils/jwt";
import { getProjectEditAccess } from "@/lib/projects/access";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, inviteeEmail } = await request.json();

  if (!projectId) {
    return NextResponse.json(
      { error: "Missing projectId" },
      { status: 400 }
    );
  }

  // Authorization uses the verified auth identity, never mutable profile
  // email. Team email columns are not client-readable, so membership is
  // resolved with the service client (lead or teammate only).
  const userEmail = auth.user.email?.trim().toLowerCase();
  const accessResult = await getProjectEditAccess(createSupabaseServiceClient(), {
    projectId,
    userId: auth.user.id,
    userEmail,
    allowOrganizer: false,
  });

  if (!accessResult.access) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (!accessResult.access.isLead && !accessResult.access.isTeammate) {
    return NextResponse.json(
      { error: "Forbidden: Only project lead or teammates can generate invite links" },
      { status: 403 }
    );
  }

  try {
    // Generate JWT token with 10-minute expiry
    const token = await generateProjectInviteToken(
      {
        email: inviteeEmail || "",
        projectId,
        invitedBy: userEmail || auth.user.id,
      },
      600 // 10 minutes
    );

    return NextResponse.json({ token });
  } catch (error) {
    console.error("Error generating token:", error);
    return NextResponse.json(
      { error: "Failed to generate invite token" },
      { status: 500 }
    );
  }
}
