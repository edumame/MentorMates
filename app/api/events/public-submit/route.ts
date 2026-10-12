import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { ApprovalStatus, EventVisibility } from "@/lib/types";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { sendEventApprovalNotification } from "@/lib/email/send-event-approval-notification";

const submitSchema = z.object({
  submitter_name: z.string().min(1, "Name is required").max(120),
  email: z.string().email("Invalid email address"),
  affiliation: z
    .string()
    .max(200, "Affiliation must be at most 200 characters")
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : null)),
  event_name: z.string().min(3, "Event name must be at least 3 characters").max(200),
  event_blurb: z
    .string()
    .max(1000, "Description must be at most 1000 characters")
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : null)),
  start_datetime: z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
    message: "Invalid start datetime",
  }),
  end_datetime: z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
    message: "Invalid end datetime",
  }),
  location: z.string().min(1, "Location is required"),
  link: z.string().url("Link must be a valid URL"),
  expected_attendance: z
    .number()
    .int("Expected attendance must be a whole number")
    .positive("Expected attendance must be positive")
    .max(1_000_000)
    .nullable()
    .optional()
    .transform((v) => v ?? null),
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

  const {
    submitter_name,
    email,
    affiliation,
    event_name,
    event_blurb,
    start_datetime,
    end_datetime,
    location,
    link,
    expected_attendance,
    want_featured,
  } = parsed.data;

  if (Date.parse(end_datetime) < Date.parse(start_datetime)) {
    return NextResponse.json(
      { error: "End date/time must be on or after start date/time" },
      { status: 400 }
    );
  }

  // Attribute the submission to the signed-in user when there is one; the form
  // itself stays open to anonymous visitors.
  let ownerId: string | null = null;
  try {
    const authClient = await createSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    ownerId = user?.id ?? null;
  } catch {
    ownerId = null;
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
      // External listings should send visitors to the organizer's own page once approved.
      external_redirect_enabled: true,
      visibility: EventVisibility.Public,
      approval_status: ApprovalStatus.Submitted,
      featured: false,
      featured_requested: want_featured,
      owner_id: ownerId,
      submitter_email: email,
      submitter_name,
      organizer_affiliation: affiliation,
      expected_attendance,
      event_blurb,
      rules: [], // events.rules is NOT NULL with no default — required for any insert
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
  const organizerLabel = [
    submitter_name,
    affiliation ? `(${affiliation})` : null,
    want_featured ? "— FEATURED request" : null,
  ]
    .filter(Boolean)
    .join(" ");

  sendEventApprovalNotification({
    eventName: event_name,
    organizerName: organizerLabel,
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
