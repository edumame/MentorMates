import { EventRole, EventVisibility } from "@/lib/types";
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

// Matches PostgREST's default row cap, so a full page means there may be more.
const USER_ID_PAGE_SIZE = 1000;

async function collectUserIds(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: { user_id: string }[] | null;
    error: unknown;
  }>,
): Promise<Set<string>> {
  const userIds = new Set<string>();

  for (let from = 0; ; from += USER_ID_PAGE_SIZE) {
    const { data, error } = await fetchPage(
      from,
      from + USER_ID_PAGE_SIZE - 1,
    );

    if (error) {
      throw new Error("Failed to count reserved seats");
    }

    data?.forEach(({ user_id }) => userIds.add(user_id));

    if ((data?.length ?? 0) < USER_ID_PAGE_SIZE) {
      return userIds;
    }
  }
}

/**
 * Counts seats that are spoken for: participants who have joined, plus, on paid
 * events, approved users who have not joined yet. Paid approvals create no role
 * until after payment, so without the second group they would hold no seat.
 *
 * Reads other users' rows, so callers must pass a service client (RLS would
 * otherwise hide them). Throws on a query error so callers fail closed.
 */
export async function countReservedParticipantSeats(
  supabase: ServiceSupabaseClient,
  options: { eventId: string; paid: boolean; excludeUserId?: string },
): Promise<number> {
  const { eventId, paid, excludeUserId } = options;

  const reservedUserIds = await collectUserIds((from, to) =>
    supabase
      .from("user_event_roles")
      .select("user_id")
      .eq("event_id", eventId)
      .eq("role", EventRole.Participant)
      .order("user_id")
      .range(from, to),
  );

  if (paid) {
    const approvedUserIds = await collectUserIds((from, to) =>
      supabase
        .from("participant_approval_requests")
        .select("user_id")
        .eq("event_id", eventId)
        .eq("requested_role", EventRole.Participant)
        .eq("status", "approved")
        .order("user_id")
        .range(from, to),
    );

    approvedUserIds.forEach((userId) => reservedUserIds.add(userId));
  }

  if (excludeUserId) {
    reservedUserIds.delete(excludeUserId);
  }

  return reservedUserIds.size;
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

  if (channel === "agent" && event.paid) {
    return failure(403, {
      error: "Paid events cannot be joined through the agent API.",
    });
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
      const { data: payment } = event.paid
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
        .select("id")
        .eq("event_id", eventId)
        .eq("context", "registration")
        .eq("submitter_user_id", userId)
        .eq("status", "submitted")
        .maybeSingle()
        .overrideTypes<{ id: string } | null>();

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

    if (existingRequest?.status === "approved") {
      if (event.paid && channel === "web") {
        const { data: payment, error: paymentError } = await findPaidPayment(
          supabase,
          eventId,
          userId,
        );

        if (paymentError) {
          return failure(500, { error: "Failed to verify payment status" });
        }

        if (!payment) {
          return failure(402, {
            error:
              "Payment required. Your request has been approved, but payment is still needed.",
            requires_approval: false,
            request_status: "approved_pending_payment",
          });
        }
      }
    } else if (!existingRequest) {
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
    } else {
      return failure(403, {
        error:
          "Your previous request was not approved. Please contact the organizers.",
        requires_approval: false,
        request_status: existingRequest.status,
      });
    }
  }

  const { error: roleError } = await supabase.from("user_event_roles").upsert(
    {
      user_id: userId,
      event_id: eventId,
      role: EventRole.Participant,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,event_id" },
  );

  if (roleError) {
    return failure(500, { error: "Failed to join event" });
  }

  return {
    status: "joined",
    requiresApproval: false,
    requestStatus: "joined",
    message: `Joined ${event.event_name || "event"} as a participant`,
  };
}
