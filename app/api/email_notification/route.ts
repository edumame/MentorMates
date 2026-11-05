import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { canAccessRole } from "@/features/user/roles/roles";
import { NOTIFICATIONS_EMAIL_FROM } from "@/lib/email_templates/constants";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EventRole } from "@/lib/types";

// Organizer broadcasts only. The sender and "to" address are fixed here, and
// every recipient must belong to the event, so this can't relay mail to strangers.
const BROADCAST_TO = "admin@mentormates.ai";

// assuming resend allows 50 recipients per email, we need to send in batches of 49 to include the "to" recipient
const MAX_RECIPIENTS_PER_BATCH = 49;
const MEMBER_LOOKUP_BATCH_SIZE = 100;

const broadcastSchema = z.object({
  eventId: z.string().min(1),
  subject: z.string().min(1),
  html: z.string().min(1),
  bcc: z.array(z.string().email()).min(1),
});

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

async function findEventMemberEmails(
  eventId: string,
  emails: string[]
): Promise<Set<string>> {
  const service = createSupabaseServiceClient();
  const members = new Set<string>();

  for (const batch of chunkArray(emails, MEMBER_LOOKUP_BATCH_SIZE)) {
    const { data, error } = await service
      .from("user_event_roles")
      .select("user_profiles!user_event_roles_user_id_fkey1!inner(email)")
      .eq("event_id", eventId)
      .in("user_profiles.email", batch);

    if (error) throw error;

    for (const row of data ?? []) {
      const profile = Array.isArray(row.user_profiles)
        ? row.user_profiles[0]
        : row.user_profiles;
      if (profile?.email) members.add(profile.email);
    }
  }

  return members;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = broadcastSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const { eventId, subject, html, bcc } = parsed.data;

    const { data: roleRow } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();
    const isOrganizer =
      roleRow && canAccessRole(roleRow.role as EventRole, EventRole.Organizer);

    if (!isOrganizer) {
      const { data: isAdmin } = await supabase.rpc("is_admin_user", {
        user_id: user.id,
      });
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const recipients = Array.from(new Set(bcc));
    const members = await findEventMemberEmails(eventId, recipients);
    if (recipients.some((email) => !members.has(email))) {
      return NextResponse.json(
        { error: "All recipients must belong to this event" },
        { status: 403 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const batches = chunkArray(recipients, MAX_RECIPIENTS_PER_BATCH);
    const results = await Promise.allSettled(
      batches.map((batch) =>
        resend.emails.send({
          from: NOTIFICATIONS_EMAIL_FROM,
          to: BROADCAST_TO,
          subject,
          html,
          bcc: batch,
        })
      )
    );

    const failures = results.filter(
      (result) =>
        result.status === "rejected" ||
        (result.status === "fulfilled" && result.value.error)
    );

    if (failures.length > 0) {
      console.error("Some email batches failed:", failures);
      return NextResponse.json(
        { error: "Some emails failed to send", failedBatches: failures.length },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { message: `Email sent successfully in ${batches.length} batch(es)` },
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
