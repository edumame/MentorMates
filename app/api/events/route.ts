import { NextResponse } from "next/server";
import { ApprovalStatus, EventRole, EventVisibility } from "@/lib/types";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { z } from "zod";
import type { Database, Json } from "@/lib/database.types";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { randomUUID } from "crypto";
import { Resend } from "resend";
import { NOTIFICATIONS_EMAIL_FROM } from "@/lib/email_templates/constants";
import {
  normalizeInviteEmails,
  sendEventInviteEmails,
  sendOrganizerInviteEmails,
} from "@/lib/events/invite-emails";
import { EVENT_CARD_COLUMNS } from "@/lib/events/event-card-columns";
import { resolveCreateModeration } from "@/lib/events/create-moderation";
import { isHttpUrl } from "@/lib/events/approval";
import { reserveInviteQuota } from "@/lib/email/invite-quota";
import { EVENT_ROW_COLUMNS } from "@/lib/events/event-columns";
import {
  DUPLICATE_EVENT_SLUG_MESSAGE,
  getEventSlugError,
  isDuplicateEventSlugError,
} from "@/lib/events/event-slug";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

// Listing (PUB-013): everyone sees listed events (public + approved). Signed-in
// users additionally see events they hold a role in (including private, draft
// and archived ones RLS lets them read). Private events are unlisted and are
// never enumerated for non-members. Card columns only — never select("*").
export async function GET() {
  const supabase = await createSupabaseClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const listedEvents = () =>
      supabase
        .from("events")
        .select(EVENT_CARD_COLUMNS)
        .eq("visibility", EventVisibility.Public)
        .eq("approval_status", ApprovalStatus.Approved);

    if (!user) {
      const { data: visibleEvents, error: visibleError } = await listedEvents();
      if (visibleError) throw visibleError;
      return NextResponse.json({ events: visibleEvents });
    }

    const userId = user.id;

    const { data: userRoles, error: rolesError } = await supabase
      .from("user_event_roles")
      .select("event_id, role")
      .eq("user_id", userId);

    if (rolesError) throw rolesError;

    const { data: isAdmin } = await supabase.rpc("is_admin_user", {
      user_id: userId,
    });

    const memberEventIds = Array.from(
      new Set((userRoles ?? []).map((role) => role.event_id).filter(isUuid))
    );

    let query;
    if (isAdmin) {
      // Admins can see all events (RLS also allows it).
      query = supabase.from("events").select(EVENT_CARD_COLUMNS);
    } else if (memberEventIds.length > 0) {
      query = supabase
        .from("events")
        .select(EVENT_CARD_COLUMNS)
        .or(
          `and(visibility.eq.${EventVisibility.Public},approval_status.eq.${ApprovalStatus.Approved}),` +
            `event_id.in.(${memberEventIds.join(",")})`
        );
    } else {
      query = listedEvents();
    }

    const { data: events, error: eventsError } = await query;

    if (eventsError) throw eventsError;

    const eventsWithRole = (events ?? []).map((event) => {
      const userRole =
        userRoles.find((role) => role.event_id === event.event_id)?.role ||
        null;
      return { ...event, userRole };
    });

    return NextResponse.json({ events: eventsWithRole });
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

// Submission window values must be absolute instants. A naive
// "YYYY-MM-DDTHH:mm" would be stored as UTC by the timestamptz column and
// shift the window by the organizer's offset (ORG-015).
const isoInstantWithOffset = (field: string) =>
  z
    .string()
    .refine(
      (v) => /(Z|[+-]\d{2}:?\d{2})$/i.test(v.trim()) && !Number.isNaN(Date.parse(v)),
      { message: `${field} must be an ISO 8601 date-time with a time zone offset` }
    );

const eventSchema = z.object({
  event_name: z
    .string()
    .trim()
    .min(3, "Event name must be at least 3 characters")
    .max(120, "Event name must be at most 120 characters"),
  event_date: z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
    message: "Invalid event_date - expected ISO date string",
  }),
  location: z.string().min(1, "Location is required"),
  visibility: z.nativeEnum(EventVisibility).optional(),
  slug: z
    .string()
    .trim()
    .superRefine((slug, ctx) => {
      const message = getEventSlugError(slug);
      if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    })
    .optional(),
  cover_image_url: z.string().url().optional(),
  event_description: z.string().optional(),
  event_blurb: z.string().optional(),
  external_url: z
    .string()
    .trim()
    .url("external_url must be a valid URL")
    .refine(isHttpUrl, "external_url must start with http:// or https://")
    .optional(),
  external_redirect_enabled: z.boolean().optional(),
  submission_time_start: isoInstantWithOffset("submission_time_start").optional(),
  submission_time_cutoff: isoInstantWithOffset("submission_time_cutoff").optional(),
  participant_capacity: z.number().int().nonnegative().optional(),
  paid: z.boolean().optional(),
  stripe_price_id: z.string().optional(),
  event_schedule: z.array(z.record(z.string(), z.unknown())).optional(),
  event_resources: z
    .array(
      z.object({
        name: z.string(),
        link: z.string(),
      })
    )
    .optional(),
  faq: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string(),
      })
    )
    .optional(),
  tracks: z
    .array(
      z.object({
        client_id: z.string().min(1),
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        scoring_criteria: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .optional(),
  prizes: z
    .array(
      z.object({
        track_client_id: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
        cover_image_url: z.string().url().nullable().optional(),
      })
    )
    .optional(),
  rules: z
    .array(
      z.object({
        title: z.string(),
        items: z.array(z.string()),
      })
    )
    .optional(),
  approval_status: z.nativeEnum(ApprovalStatus).optional(),
  featured: z.boolean().optional(),
  event_type: z.array(z.string()).optional(),
}).superRefine((event, ctx) => {
  if (
    event.submission_time_start &&
    event.submission_time_cutoff &&
    Date.parse(event.submission_time_cutoff) <= Date.parse(event.submission_time_start)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["submission_time_cutoff"],
      message: "Submissions must close after they open",
    });
  }
});

const payloadSchema = z.object({
  event: eventSchema,
  participantInviteEmails: z.array(z.string().email()).optional(),
  judgeInviteEmails: z.array(z.string().email()).optional(),
  organizerEmails: z.array(z.string().email()).optional(),
});

export async function POST(req: Request) {
  const supabase = await createSupabaseClient();
  const serviceSupabase = createSupabaseServiceClient();

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin via DB function; no longer needed for general event creation flow

    // const { data: isAdmin } = await supabase.rpc("is_admin_user", {
    //   user_id: user.id,
    // });
    // if (!isAdmin) {
    //   return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // }

    const json = await req.json();
    const parsed = payloadSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const {
      event,
      participantInviteEmails = [],
      judgeInviteEmails = [],
      organizerEmails = [],
    } = parsed.data;

    // Visibility/approval/featured are moderation fields: never trust the
    // client on create (ORG-002). Non-admins get draft or private, unapproved.
    const { data: isAdmin } = await supabase.rpc("is_admin_user", { user_id: user.id });
    const moderation = resolveCreateModeration({
      isAdmin: isAdmin === true,
      visibility: event.visibility,
      approvalStatus: event.approval_status,
      featured: event.featured,
    });

    // Build insert payload, providing sane defaults
    const insertPayload: Database["public"]["Tables"]["events"]["Insert"] = {
      event_name: event.event_name,
      event_date: event.event_date,
      location: event.location,
      rules: ((event.rules ?? []) as unknown as Json),
      visibility: moderation.visibility as Database["public"]["Enums"]["event_visibility"],
      slug: event.slug ?? null,
      cover_image_url: event.cover_image_url ?? null,
      event_description: event.event_description ?? null,
      event_blurb: event.event_blurb ?? null,
      external_url: event.external_url ?? null,
      external_redirect_enabled: event.external_redirect_enabled ?? false,
      submission_time_start: event.submission_time_start ?? null,
      submission_time_cutoff: event.submission_time_cutoff ?? null,
      participant_capacity: event.participant_capacity ?? null,
      paid: event.paid ?? null,
      stripe_price_id: event.stripe_price_id ?? null,
      ...(event.event_schedule ? { event_schedule: event.event_schedule as Json } : {}),
      event_resources: (event.event_resources as Json) ?? ([] as Json),
      faq: (event.faq as Json) ?? null,
      owner_id: user.id, // Set the creator as the owner
      approval_status: moderation.approval_status,
      featured: moderation.featured,
      event_type: (event.event_type ?? []) as string[],
    };

    const { data: createdEvent, error: insertError } = await supabase
      .from("events")
      .insert(insertPayload)
      .select(EVENT_ROW_COLUMNS)
      .single();

    if (insertError || !createdEvent) {
      console.error("Error creating event:", insertError);

      if (isDuplicateEventSlugError(insertError)) {
        return NextResponse.json(
          { error: DUPLICATE_EVENT_SLUG_MESSAGE },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "Failed to create event" },
        { status: 500 }
      );
    }

    // RLS only lets users self-assign the participant role.
    const { error: creatorRoleError } = await serviceSupabase
      .from("user_event_roles")
      .upsert(
        {
          user_id: user.id,
          event_id: createdEvent.event_id,
          role: EventRole.Organizer,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,event_id" }
      );

    if (creatorRoleError) {
      console.error("Error assigning creator as organizer:", creatorRoleError);
      return NextResponse.json(
        { error: "Event created but assigning creator role failed" },
        { status: 500 }
      );
    }

    const clientToDbTrackId = new Map<string, string>();
    if (event.tracks && event.tracks.length > 0) {
      const trackInserts: Database["public"]["Tables"]["event_tracks"]["Insert"][] =
        event.tracks.map((track) => {
          const trackId = randomUUID();
          clientToDbTrackId.set(track.client_id, trackId);

          return {
            track_id: trackId,
            event_id: createdEvent.event_id,
            name: track.name,
            description: track.description ?? null,
            scoring_criteria: (track.scoring_criteria as Json) ?? null,
            updated_at: new Date().toISOString(),
          };
        });

      const { error: trackInsertError } = await supabase
        .from("event_tracks")
        .insert(trackInserts);

      if (trackInsertError) {
        console.error("Error creating tracks:", trackInsertError);
        return NextResponse.json(
          { error: "Event created but creating tracks failed" },
          { status: 500 }
        );
      }
    }

    const skippedPrizes: string[] = [];
    if (event.prizes && event.prizes.length > 0) {
      const prizeInserts: Database["public"]["Tables"]["prizes"]["Insert"][] = [];

      for (const prize of event.prizes) {
        const dbTrackId = clientToDbTrackId.get(prize.track_client_id);
        if (!dbTrackId) {
          skippedPrizes.push(prize.track_client_id);
          continue;
        }

        prizeInserts.push({
          track_id: dbTrackId,
          prize_amount: prize.name,
          prize_description: prize.description ?? "",
          updated_at: new Date().toISOString(),
        });
      }

      if (prizeInserts.length > 0) {
        const { error: prizeInsertError } = await supabase
          .from("prizes")
          .insert(prizeInserts);

        if (prizeInsertError) {
          console.error("Error creating prizes:", prizeInsertError);
          return NextResponse.json(
            { error: "Event created but creating prizes failed" },
            { status: 500 }
          );
        }
      }
    }

    const { data: inviterProfile } = await supabase
      .from("user_profiles")
      .select("display_name, email")
      .eq("uid", user.id)
      .maybeSingle();

    const inviterName =
      inviterProfile?.display_name?.trim() ||
      inviterProfile?.email?.trim() ||
      "A MentorMates organizer";
    const inviterEmail = user.email?.trim().toLowerCase() || null;

    // Co-organizers are never granted access directly by email (ORG-012 /
    // MENT-008): user_profiles.email is user-editable, and a direct grant would
    // also silently convert an existing participant and reveal which addresses
    // have accounts. Every invitee gets a signed invitation link instead; the
    // role is granted only when they accept it while signed in with that
    // verified auth email (app/api/events/[eventId]/accept-invite).
    const pendingOrganizerInviteEmails = normalizeInviteEmails(organizerEmails).filter(
      (email) => email !== inviterEmail
    );

    const resend = getResend();
    const sendEmail = resend
      ? async ({ to, subject, html }: { to: string; subject: string; html: string }) => {
          try {
            const { error } = await resend.emails.send({
              from: NOTIFICATIONS_EMAIL_FROM,
              to,
              subject,
              html,
            });

            if (error) {
              console.error("Failed to send event invite email:", error);
              return false;
            }

            return true;
          } catch (emailError) {
            console.error("Error sending event invite email:", emailError);
            return false;
          }
        }
      : undefined;

    // Same daily invitation caps as the invite-organizer route (A2 helper).
    // Emails past the cap are reported as failed instead of sent.
    const quotaAllowedOrganizerEmails: string[] = [];
    const quotaLimitedOrganizerEmails: string[] = [];
    if (sendEmail) {
      for (const email of pendingOrganizerInviteEmails) {
        if (quotaLimitedOrganizerEmails.length > 0) {
          quotaLimitedOrganizerEmails.push(email);
          continue;
        }
        const quotaResponse = await reserveInviteQuota(serviceSupabase, user.id, createdEvent.event_id);
        if (quotaResponse) quotaLimitedOrganizerEmails.push(email);
        else quotaAllowedOrganizerEmails.push(email);
      }
    } else {
      quotaAllowedOrganizerEmails.push(...pendingOrganizerInviteEmails);
    }

    const sentOrganizerInviteSummary = await sendOrganizerInviteEmails({
      appOrigin: process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin,
      eventId: createdEvent.event_id,
      eventName: createdEvent.event_name,
      inviterName,
      // Invitees have no access until they accept, so they all get the
      // "accept invitation" copy rather than "already activated".
      newOrganizerEmails: quotaAllowedOrganizerEmails,
      sendEmail,
    });
    const organizerInviteSummary = {
      ...sentOrganizerInviteSummary,
      failed: [...sentOrganizerInviteSummary.failed, ...quotaLimitedOrganizerEmails],
    };

    const inviteSummary = await sendEventInviteEmails({
      appOrigin: process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin,
      eventId: createdEvent.event_id,
      eventName: createdEvent.event_name,
      inviterName,
      visibility:
        (createdEvent.visibility as EventVisibility | null) ??
        EventVisibility.Draft,
      participantInviteEmails,
      judgeInviteEmails,
      sendEmail,
    });

    return NextResponse.json(
      {
        event: createdEvent,
        organizersAssigned: 1,
        // Kept for response compatibility; never reveals which emails have accounts.
        missingOrganizerEmails: [],
        pendingOrganizerInvites: pendingOrganizerInviteEmails.length,
        // true when a public listing was requested: the event was created as
        // private and needs admin approval (POST /api/events/request-approval).
        publicListingRequiresApproval: moderation.publicRequestDeferred,
        organizerInviteSummary,
        inviteSummary,
        skippedPrizeTrackIds: skippedPrizes,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/events:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
