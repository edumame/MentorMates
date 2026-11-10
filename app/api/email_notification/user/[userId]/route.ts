import { NextResponse, NextRequest } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EMAIL_TYPES } from "@/lib/email_templates/constants";
import {
  isUserEventEmailType,
  sendUserEventEmail,
} from "@/lib/email/send-user-event-email";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Send one event email to one member of the event.
 *
 * Only organizers/owners of the event or admins may email members. A member
 * may request their own check-in email. The event name always comes from the
 * database (any client-supplied eventName is ignored).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const eventId = body?.eventId;
  const emailType = body?.emailType;
  const { userId } = await params;

  if (typeof eventId !== "string" || !UUID_RE.test(eventId) || !userId || !UUID_RE.test(userId)) {
    return NextResponse.json(
      { error: "A valid event ID and user ID are required" },
      { status: 400 }
    );
  }
  if (!isUserEventEmailType(emailType)) {
    return NextResponse.json({ error: "Unsupported email type" }, { status: 400 });
  }

  const [{ data: isOrganizer }, { data: isAdmin }] = await Promise.all([
    supabase.rpc("is_event_organizer_or_owner", {
      p_event_id: eventId,
      p_user_id: user.id,
    }),
    supabase.rpc("is_admin_user", { user_id: user.id }),
  ]);

  const isSelfCheckin =
    emailType === EMAIL_TYPES.CHECKIN_QR_CODE && userId === user.id;

  if (!isOrganizer && !isAdmin && !isSelfCheckin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await sendUserEventEmail({
    service: createSupabaseServiceClient(),
    eventId,
    userId,
    emailType,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ message: "Email sent successfully" }, { status: 200 });
}
