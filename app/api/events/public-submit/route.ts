import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { ApprovalStatus, EventVisibility } from "@/lib/types";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { sendEventApprovalNotification } from "@/lib/email/send-event-approval-notification";

const submitSchema = z.object({
  email: z.string().email("Invalid email address"),
  event_name: z.string().min(3, "Event name must be at least 3 characters").max(200),
  start_datetime: z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
    message: "Invalid start datetime",
  }),
  end_datetime: z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
    message: "Invalid end datetime",
  }),
  location: z.string().min(1, "Location is required"),
  link: z.string().url("Link must be a valid URL"),
  want_featured: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = submitSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { email, event_name, start_datetime, end_datetime, location, link, want_featured } =
    parsed.data;

  if (Date.parse(end_datetime) < Date.parse(start_datetime)) {
    return NextResponse.json(
      { error: "End date/time must be on or after start date/time" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServiceClient();

  const slug = slugify(event_name, randomUUID().slice(0, 6));

  const { data, error } = await supabase
    .from("events")
    .insert({
      event_id: randomUUID(),
      event_name,
      slug,
      event_date: start_datetime,
      submission_time_start: start_datetime,
      submission_time_cutoff: end_datetime,
      location,
      external_url: link,
      visibility: EventVisibility.Public,
      approval_status: ApprovalStatus.Submitted,
      featured: false,
      owner_id: null,
      submitter_email: email,
      event_blurb: want_featured
        ? "[Submitter requested featured placement]"
        : null,
    })
    .select("event_id")
    .single();

  if (error) {
    console.error("public-submit insert failed", error);
    return NextResponse.json(
      { error: "Failed to submit event. Please try again." },
      { status: 500 }
    );
  }

  // Notify admins via Resend (fire-and-forget) so they know to review the new submission
  sendEventApprovalNotification({
    eventName: event_name,
    organizerName: want_featured
      ? "Anonymous submission (FEATURED request)"
      : "Anonymous submission",
    organizerEmail: email,
    eventDate: start_datetime,
    location,
    eventId: slug,
  }).catch((err) =>
    console.error("Failed to send admin approval notification email:", err)
  );

  return NextResponse.json({ ok: true, event_id: data.event_id }, { status: 201 });
}

function slugify(name: string, suffix: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return base ? `${base}-${suffix}` : `event-${suffix}`;
}
