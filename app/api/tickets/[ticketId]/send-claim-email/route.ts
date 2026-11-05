import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { sendHtmlEmail } from "@/lib/email/send-html-email";
import { getClaimTicketEmailTemplate } from "@/lib/email_templates/claim-ticket";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const { ticketId } = await params;
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createSupabaseServiceClient();
  const { data: ticket } = await service
    .from("event_tickets")
    .select("id, event_id, purchased_by_user_id, assigned_to_email")
    .eq("id", ticketId)
    .maybeSingle();

  // One response for both cases, so this can't be used to probe ticket IDs.
  if (!ticket || ticket.purchased_by_user_id !== user.id) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  if (!ticket.assigned_to_email) {
    return NextResponse.json(
      { error: "Ticket has not been assigned" },
      { status: 400 }
    );
  }

  const { data: event } = await service
    .from("events")
    .select("event_name")
    .eq("event_id", ticket.event_id)
    .maybeSingle();

  const email = getClaimTicketEmailTemplate(
    event?.event_name || "Event",
    ticket.id,
    user.user_metadata?.display_name || user.email || "Someone"
  );

  const sent = await sendHtmlEmail({
    to: ticket.assigned_to_email,
    subject: email.subject,
    html: email.html,
  });

  if (!sent) {
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
