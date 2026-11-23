import {
  EventRole,
  EventVisibility,
  ParticipantRequestStatus,
} from "@/lib/types";
import type { Database } from "@/lib/database.types";
import type { ServiceSupabaseClient } from "@/lib/supabase/service";

export interface ParticipantJoinSuccess {
  status: "joined" | "approval_requested";
  requestId?: string;
  requiresApproval: boolean;
  requestStatus?: string;
  message: string;
}

export interface ParticipantJoinFailure {
  status: "error";
  httpStatus: number;
  payload: Record<string, unknown>;
}

export type ParticipantJoinResult =
  | ParticipantJoinSuccess
  | ParticipantJoinFailure;

interface JoinParticipantEventOptions {
  eventId: string;
  userId: string;
  channel: "web" | "agent";
}

/**
 * SQLSTATE raised by the database capacity guards: enforce_participant_capacity
 * (participant role insert) and enforce_paid_participant_seat_hold (approving a
 * paid participant request). Both take the event row lock, so this is what a
 * request that lost a race for the last seat gets back.
 */
export const EVENT_FULL_DB_ERROR_CODE = "45000";

export const EVENT_FULL_APPROVAL_MESSAGE =
  "Event is at full capacity. Cannot approve more participants.";

export function isEventFullDbError(
  error: { code?: string | null } | null | undefined,
): boolean {
  return error?.code === EVENT_FULL_DB_ERROR_CODE;
}

// Matches PostgREST's default row cap, so a full page means there may be more.
const SEAT_ROW_PAGE_SIZE = 1000;

async function collectRows<Row>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: Row[] | null;
    error: unknown;
  }>,
): Promise<Row[]> {
  const rows: Row[] = [];

  for (let from = 0; ; from += SEAT_ROW_PAGE_SIZE) {
    const { data, error } = await fetchPage(
      from,
      from + SEAT_ROW_PAGE_SIZE - 1,
    );

    if (error) {
      throw new Error("Failed to count reserved seats");
    }

    rows.push(...(data ?? []));

    if ((data?.length ?? 0) < SEAT_ROW_PAGE_SIZE) {
      return rows;
    }
  }
}

/**
 * Counts seats that are spoken for: participants who have joined, plus, on paid
 * events, approved users who hold no role yet. Paid approvals create no role
 * until after payment, so without the second group they would hold no seat.
 *
 * A user who took another role is not waiting for a seat, so they are left out.
 * Users who gave a seat up are no longer "approved": see
 * releaseParticipantSeatReservation.
 *
 * Reads other users' rows, so callers must pass a service client (RLS would
 * otherwise hide them). Throws on a query error so callers fail closed.
 */
export async function countReservedParticipantSeats(
  supabase: ServiceSupabaseClient,
  options: { eventId: string; paid: boolean; excludeUserId?: string },
): Promise<number> {
  const { eventId, paid, excludeUserId } = options;

  const roleRows = await collectRows<{ user_id: string; role: string }>(
    (from, to) =>
      supabase
        .from("user_event_roles")
        .select("user_id, role")
        .eq("event_id", eventId)
        .order("user_id")
        .range(from, to),
  );

  const reservedUserIds = new Set(
    roleRows
      .filter(({ role }) => role === EventRole.Participant)
      .map(({ user_id }) => user_id),
  );

  if (paid) {
    const roleHolderIds = new Set(roleRows.map(({ user_id }) => user_id));
    const approvedRows = await collectRows<{ user_id: string }>((from, to) =>
      supabase
        .from("participant_approval_requests")
        .select("user_id")
        .eq("event_id", eventId)
        .eq("requested_role", EventRole.Participant)
        .eq("status", ParticipantRequestStatus.Approved)
        .order("user_id")
        .range(from, to),
    );

    approvedRows
      .filter(({ user_id }) => !roleHolderIds.has(user_id))
      .forEach(({ user_id }) => reservedUserIds.add(user_id));
  }

  if (excludeUserId) {
    reservedUserIds.delete(excludeUserId);
  }

  return reservedUserIds.size;
}

/**
 * Whether userId can take a participant seat, not counting their own
 * reservation. The one capacity rule for approving and for checkout, so the
 * web and agent paths cannot drift apart. Throws on a query error.
 */
export async function isParticipantSeatAvailable(
  supabase: ServiceSupabaseClient,
  options: { eventId: string; userId: string },
): Promise<boolean> {
  const { eventId, userId } = options;

  const { data: event, error } = await supabase
    .from("events")
    .select("participant_capacity, paid")
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    throw new Error("Failed to verify event capacity");
  }

  if (event?.participant_capacity == null) {
    return true;
  }

  const reservedSeats = await countReservedParticipantSeats(supabase, {
    eventId,
    paid: Boolean(event.paid),
    excludeUserId: userId,
  });

  return reservedSeats < event.participant_capacity;
}

/**
 * Ends a paid approval's seat reservation. Call this wherever a user leaves or
 * is removed from an event, before deleting their role: on a paid event an
 * approved row counts as a held seat, and deleting the role alone leaves it
 * held forever. The user can ask to join again, which reopens the request.
 *
 * Free events are skipped because approved rows hold no seat there. Needs a
 * service client, since RLS stops users changing their own approved request.
 * Throws on a query error so a seat is never silently left held.
 */
export async function releaseParticipantSeatReservation(
  supabase: ServiceSupabaseClient,
  options: { eventId: string; userId: string },
): Promise<void> {
  const { eventId, userId } = options;

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("paid")
    .eq("event_id", eventId)
    .maybeSingle();

  if (eventError) {
    throw new Error("Failed to release seat reservation");
  }

  if (!event?.paid) {
    return;
  }

  const { error } = await supabase
    .from("participant_approval_requests")
    .update({
      status: ParticipantRequestStatus.Withdrawn,
      updated_at: new Date().toISOString(),
    })
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .eq("requested_role", EventRole.Participant)
    .eq("status", ParticipantRequestStatus.Approved);

  if (error) {
    throw new Error("Failed to release seat reservation");
  }
}

async function findPaidPayment(
  supabase: ServiceSupabaseClient,
  eventId: string,
  userId: string,
) {
  return supabase
    .from("user_event_payments")
    .select("payment_status")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .eq("payment_status", "paid")
    .maybeSingle()
    .overrideTypes<{
      payment_status: Database["public"]["Tables"]["user_event_payments"]["Row"]["payment_status"];
    } | null>();
}

export const EVENT_CLOSED_FOR_ENROLLMENT_MESSAGE =
  "This event is not open for enrollment.";

/**
 * Private events are intentionally usable before public-listing approval.
 * Draft/rejected events, unapproved public listings and archived (read-only,
 * XL-001) events are not open enrollment. Shared by the web and agent joins
 * and by checkout, so nobody is charged for an event they could not join.
 */
export function isEventClosedForEnrollment(event: {
  visibility: string | null;
  approval_status: string | null;
}) {
  return (
    event.visibility === EventVisibility.Draft ||
    event.visibility === EventVisibility.Archived ||
    event.approval_status === "rejected" ||
    (event.visibility === EventVisibility.Public && event.approval_status !== "approved")
  );
}

function failure(
  httpStatus: number,
  payload: Record<string, unknown>,
): ParticipantJoinFailure {
  return {
    status: "error",
    httpStatus,
    payload,
  };
}

/**
 * 409 for a full event. A paid user who reaches this has already been charged,
 * so they get refund guidance instead of the generic message.
 */
async function eventFullFailure(
  supabase: ServiceSupabaseClient,
  paid: boolean | null | undefined,
  eventId: string,
  userId: string,
): Promise<ParticipantJoinFailure> {
  const { data: payment } = paid
    ? await findPaidPayment(supabase, eventId, userId)
    : { data: null };

  if (payment) {
    // Nothing refunds this automatically, so the log is what staff act on.
    console.error("Paid user could not join a full event", {
      eventId,
      userId,
    });
    return failure(409, {
      error:
        "This event filled up before your registration finished, so you do not have a seat. Your payment went through. Please contact the organizers for a refund.",
      refund_required: true,
    });
  }

  return failure(409, { error: "Event is full. No seats available." });
}

export async function joinParticipantEvent(
  supabase: ServiceSupabaseClient,
  options: JoinParticipantEventOptions,
): Promise<ParticipantJoinResult> {
  const { eventId, userId, channel } = options;

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select(
      "event_id, event_name, visibility, approval_status, require_participant_approval, participant_capacity, paid",
    )
    .eq("event_id", eventId)
    .maybeSingle()
    .overrideTypes<Pick<
      Database["public"]["Tables"]["events"]["Row"],
      | "event_id"
      | "event_name"
      | "visibility"
      | "approval_status"
      | "require_participant_approval"
      | "participant_capacity"
      | "paid"
    > | null>();

  if (eventError) {
    return failure(500, { error: "Failed to fetch event" });
  }

  if (!event) {
    return failure(404, { error: "Event not found" });
  }

  if (isEventClosedForEnrollment(event)) {
    return failure(403, { error: EVENT_CLOSED_FOR_ENROLLMENT_MESSAGE });
  }

  if (channel === "agent" && event.paid) {
    return failure(403, {
      error: "Paid events cannot be joined through the agent API.",
    });
  }

  if (channel === "agent") {
    const { data: protectedRole, error: passwordError } = await supabase
      .from("role_passwords").select("role").eq("event_id", eventId)
      .eq("role", EventRole.Participant).maybeSingle()
      .overrideTypes<{ role: string } | null>();
    if (passwordError) return failure(500, { error: "Failed to verify enrollment requirements" });
    if (protectedRole) return failure(403, { error: "Join this password-protected event through the website." });
  }

  const { data: existingRole, error: existingRoleError } = await supabase
    .from("user_event_roles")
    .select("role")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle()
    .overrideTypes<{
      role: Database["public"]["Tables"]["user_event_roles"]["Row"]["role"];
    } | null>();

  if (existingRoleError) {
    return failure(500, { error: "Failed to verify participant role" });
  }

  if (existingRole) {
    return failure(409, { error: "You already have a role in this event" });
  }

  if (event.participant_capacity != null) {
    const { count, error: countError } = await supabase
      .from("user_event_roles")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("role", EventRole.Participant);

    if (countError) {
      return failure(500, { error: "Failed to check capacity" });
    }

    if ((count || 0) >= event.participant_capacity) {
      return eventFullFailure(supabase, event.paid, eventId, userId);
    }
  }

  const { data: activeRegistrationBinding, error: bindingLookupError } =
    await supabase
      .from("event_intake_form_bindings")
      .select("form_version_id")
      .eq("event_id", eventId)
      .eq("context", "registration")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .overrideTypes<{ form_version_id: string | null } | null>();

  if (bindingLookupError) {
    return failure(500, {
      error: "Failed to verify registration requirements",
    });
  }

  if (activeRegistrationBinding?.form_version_id) {
    const { data: questionnaireSubmission, error: questionnaireError } =
      await supabase
        .from("intake_form_submissions")
        .select("id, form_version_id")
        .eq("event_id", eventId)
        .eq("context", "registration")
        .eq("submitter_user_id", userId)
        .eq("status", "submitted")
        .maybeSingle()
        .overrideTypes<{ id: string; form_version_id: string | null } | null>();

    if (questionnaireError) {
      return failure(500, {
        error: "Failed to verify registration questionnaire",
      });
    }

    if (!questionnaireSubmission?.id) {
      return failure(412, {
        error:
          "Please complete the registration questionnaire before joining this event.",
        requires_registration_questionnaire: true,
      });
    }

    // ORG-010: an answer to an older version of the form does not satisfy the
    // current one (intake submission validation returns 409 for stale versions).
    if (
      questionnaireSubmission.form_version_id !==
      activeRegistrationBinding.form_version_id
    ) {
      return failure(412, {
        error:
          "The registration questionnaire has changed. Please complete the updated questionnaire before joining this event.",
        requires_registration_questionnaire: true,
        questionnaire_outdated: true,
      });
    }
  }

  if (event.require_participant_approval) {
    const { data: existingRequest, error: requestLookupError } = await supabase
      .from("participant_approval_requests")
      .select("id, status")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .eq("requested_role", EventRole.Participant)
      .maybeSingle()
      .overrideTypes<{ id: string; status: string } | null>();

    if (requestLookupError) {
      return failure(500, { error: "Failed to verify approval status" });
    }

    if (existingRequest?.status === "pending") {
      return failure(409, {
        error: "You already have a pending request for this event",
        requires_approval: true,
        request_status: "pending",
      });
    }

    if (!existingRequest) {
      const { data: newRequest, error: requestError } = await supabase
        .from("participant_approval_requests")
        .insert({
          event_id: eventId,
          user_id: userId,
          requested_role: EventRole.Participant,
          status: "pending",
        })
        .select()
        .single()
        .overrideTypes<{ id: string }>();

      if (requestError || !newRequest) {
        return failure(500, { error: "Failed to submit approval request" });
      }

      return {
        status: "approval_requested",
        requiresApproval: true,
        requestId: newRequest.id,
        requestStatus: "pending",
        message:
          "Your request has been submitted and is pending organizer approval",
      };
    } else if (existingRequest.status === ParticipantRequestStatus.Withdrawn) {
      // Includes users who left a paid event: asking again goes back to review.
      const { error: reopenError } = await supabase
        .from("participant_approval_requests")
        .update({
          status: ParticipantRequestStatus.Pending,
          reviewed_by: null,
          reviewed_at: null,
          rejection_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingRequest.id);

      if (reopenError) {
        return failure(500, { error: "Failed to submit approval request" });
      }

      return {
        status: "approval_requested",
        requiresApproval: true,
        requestId: existingRequest.id,
        requestStatus: "pending",
        message:
          "Your request has been submitted and is pending organizer approval",
      };
    } else if (existingRequest.status !== "approved") {
      return failure(403, {
        error:
          "Your previous request was not approved. Please contact the organizers.",
        requires_approval: false,
        request_status: existingRequest.status,
      });
    }
  }

  if (event.paid && channel === "web") {
    const { data: payment, error: paymentError } = await findPaidPayment(
      supabase,
      eventId,
      userId,
    );
    if (paymentError) return failure(500, { error: "Failed to verify payment status" });
    if (!payment) return failure(402, {
      error: "Payment required before joining this event.",
      requires_approval: false,
      request_status: "approved_pending_payment",
    });
  }

  const { error: roleError } = await supabase.from("user_event_roles").insert(
    {
      user_id: userId,
      event_id: eventId,
      role: EventRole.Participant,
      updated_at: new Date().toISOString(),
    },
  );

  if (roleError) {
    if (roleError.code === "23505") return failure(409, { error: "You already have a role in this event" });
    if (isEventFullDbError(roleError)) {
      return eventFullFailure(supabase, event.paid, eventId, userId);
    }
    return failure(500, { error: "Failed to join event" });
  }

  return {
    status: "joined",
    requiresApproval: false,
    requestStatus: "joined",
    message: `Joined ${event.event_name || "event"} as a participant`,
  };
}
