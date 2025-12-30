import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";

import { createSupabaseClient } from "@/app/utils/supabase/server";
import { NOTIFICATIONS_EMAIL_FROM } from "@/lib/email_templates/constants";
import { getParticipantInvitationEmailTemplate } from "@/lib/email_templates/participant-invitation";
import { EventRole } from "@/lib/types";
import { canAccessRole } from "@/features/user/roles/roles";

const ParticipantSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  approvalStatus: z.string().optional(),
  checkedInAt: z.string().optional(),
  ticketName: z.string().optional(),
});

const BodySchema = z.object({
  eventId: z.string().min(1),
  participants: z.array(ParticipantSchema).min(1),
});

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function POST(request: Request) {
  const supabase = await createSupabaseClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { eventId } = parsed.data;
  const participantsInput = parsed.data.participants;

  // Allow organizers of this event OR global admins
  const { data: userRole } = await supabase
    .from("user_event_roles")
    .select("role")
    .eq("event_id", eventId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  let isAllowed = false;
  if (userRole && canAccessRole(userRole.role as EventRole, EventRole.Organizer)) {
    isAllowed = true;
  } else {
    const { data: isAdmin } = await supabase.rpc("is_admin_user", {
      user_id: auth.user.id,
    });
    isAllowed = Boolean(isAdmin);
  }

  if (!isAllowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: eventData } = await supabase
    .from("events")
    .select("event_id, event_name, slug")
    .eq("event_id", eventId)
    .single();

  if (!eventData) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const { data: inviterProfile } = await supabase
    .from("user_profiles")
    .select("email, display_name")
    .eq("uid", auth.user.id)
    .single();

  const inviterName = inviterProfile?.display_name?.trim() || inviterProfile?.email || "An event organizer";

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  if (!resend) {
    return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
  }

  // Server-side dedupe for safety (emails are case-insensitive)
  const deduped: Array<{ email: string; name?: string }> = [];
  const seen = new Set<string>();
  for (const p of participantsInput) {
    const email = p.email.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    deduped.push({ email, name: p.name });
  }

  const sent: string[] = [];
  const failed: Array<{ email: string; error: string }> = [];

  // Keep concurrency modest to reduce provider throttling risk.
  const batches = chunk(deduped, 10);
  for (const batch of batches) {
    const results = await Promise.all(
      batch.map(async (p) => {
        try {
          const tmpl = getParticipantInvitationEmailTemplate({
            eventName: eventData.event_name,
            eventId: eventData.event_id,
            eventSlug: eventData.slug,
            inviterName,
            participantName: p.name,
          });

          const { error: emailError } = await resend.emails.send({
            from: NOTIFICATIONS_EMAIL_FROM,
            to: p.email,
            subject: tmpl.subject,
            html: tmpl.html,
          });

          if (emailError) {
            return { ok: false as const, email: p.email, error: emailError.message || "Email send failed" };
          }
          return { ok: true as const, email: p.email };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Email send failed";
          return { ok: false as const, email: p.email, error: message };
        }
      })
    );

    for (const r of results) {
      if (r.ok) sent.push(r.email);
      else failed.push({ email: r.email, error: r.error });
    }
  }

  return NextResponse.json({ sent, failed }, { status: 200 });
}


