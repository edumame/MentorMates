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

  // Private events are intentionally usable before public-listing approval.
  // Draft/rejected events, unapproved public listings and archived (read-only,
  // XL-001) events are not open enrollment. Shared by the web and agent joins.
  if (event.visibility === EventVisibility.Draft || event.visibility === EventVisibility.Archived ||
      event.approval_status === "rejected" ||
      (event.visibility === EventVisibility.Public && event.approval_status !== "approved")) {
    return failure(403, { error: "This event is not open for enrollment." });
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
    const { data: payment, error: paymentError } = await supabase
      .from("user_event_payments")
      .select("payment_status")
      .eq("user_id", userId)
      .eq("event_id", eventId)
      .eq("payment_status", "paid")
      .limit(1)
      .maybeSingle()
      .overrideTypes<{ payment_status: string } | null>();
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
    if (roleError.code === "45000") return failure(409, { error: "Event is full. No seats available." });
    return failure(500, { error: "Failed to join event" });
  }

  return {
    status: "joined",
    requiresApproval: false,
    requestStatus: "joined",
    message: `Joined ${event.event_name || "event"} as a participant`,
  };
}
