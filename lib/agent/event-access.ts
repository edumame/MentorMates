import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { ApprovalStatus, EventRole, EventVisibility } from "@/lib/types";

export interface AgentEventSummary {
  event_id: string;
  event_name: string | null;
  event_blurb: string | null;
  event_description: string | null;
  event_date: string | null;
  location: string | null;
  visibility: EventVisibility | null;
  approval_status: ApprovalStatus | null;
  require_participant_approval: boolean | null;
  participant_capacity: number | null;
  submission_time_start: string | null;
  submission_time_cutoff: string | null;
  paid: boolean | null;
  cover_image_url: string | null;
  slug: string | null;
}

const AGENT_EVENT_SELECT = `
  event_id,
  event_name,
  event_blurb,
  event_description,
  event_date,
  location,
  visibility,
  approval_status,
  require_participant_approval,
  participant_capacity,
  submission_time_start,
  submission_time_cutoff,
  paid,
  cover_image_url,
  slug
`;

/**
 * Slim shape returned to the participant agent surface. Strips internal/admin
 * fields (approval_status, paid, capacity, cover, slug, etc.) that are
 * either always-true-after-join, used only for internal filtering, or noise
 * in a CLI agent context. See issue #716.
 */
export interface ParticipantAgentEvent {
  event_id: string;
  event_name: string | null;
  event_blurb: string | null;
  event_description: string | null;
  event_date: string | null;
  location: string | null;
  visibility: EventVisibility | null;
  submission_time_start: string | null;
  submission_time_cutoff: string | null;
}

export function toParticipantAgentEvent(
  event: AgentEventSummary,
): ParticipantAgentEvent {
  return {
    event_id: event.event_id,
    event_name: event.event_name,
    event_blurb: event.event_blurb,
    event_description: event.event_description,
    event_date: event.event_date,
    location: event.location,
    visibility: event.visibility,
    submission_time_start: event.submission_time_start,
    submission_time_cutoff: event.submission_time_cutoff,
  };
}

function sortEvents(events: AgentEventSummary[]) {
  return [...events].sort((a, b) =>
    (a.event_name || a.event_id).localeCompare(b.event_name || b.event_id),
  );
}

function dedupeEvents(events: AgentEventSummary[]) {
  return Array.from(
    new Map(events.map((event) => [event.event_id, event])).values(),
  );
}

async function fetchEventsByIds(eventIds: string[]) {
  const uniqueEventIds = Array.from(new Set(eventIds.filter(Boolean)));
  if (uniqueEventIds.length === 0) {
    return [] as AgentEventSummary[];
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("events")
    .select(AGENT_EVENT_SELECT)
    .in("event_id", uniqueEventIds);

  if (error) {
    throw error;
  }

  return (data || []) as AgentEventSummary[];
}

export async function listManagedAgentEvents(userId: string) {
  const supabase = createSupabaseServiceClient();
  const { data: isAdminRpc, error: adminError } = await supabase.rpc(
    "is_admin_user",
    {
      user_id: userId,
    },
  );

  if (adminError) {
    throw adminError;
  }

  if (Boolean(isAdminRpc)) {
    const { data, error } = await supabase
      .from("events")
      .select(AGENT_EVENT_SELECT)
      .order("event_name", { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []) as AgentEventSummary[];
  }

  const [
    { data: ownedEvents, error: ownerError },
    { data: organizerRoles, error: roleError },
  ] = await Promise.all([
    supabase.from("events").select(AGENT_EVENT_SELECT).eq("owner_id", userId),
    supabase
      .from("user_event_roles")
      .select("event_id")
      .eq("user_id", userId)
      .eq("role", EventRole.Organizer),
  ]);

  if (ownerError || roleError) {
    throw ownerError || roleError;
  }

  const organizerEvents = await fetchEventsByIds(
    (organizerRoles || []).map((row) => row.event_id),
  );

  return sortEvents(
    dedupeEvents([...(ownedEvents as AgentEventSummary[]), ...organizerEvents]),
  );
}

export async function listParticipantAgentEvents(userId: string) {
  const supabase = createSupabaseServiceClient();
  const { data: participantRoles, error } = await supabase
    .from("user_event_roles")
    .select("event_id")
    .eq("user_id", userId)
    .eq("role", EventRole.Participant);

  if (error) {
    throw error;
  }

  return sortEvents(
    dedupeEvents(
      await fetchEventsByIds(
        (participantRoles || []).map((row) => row.event_id),
      ),
    ),
  );
}

export async function listJoinableParticipantAgentEvents(userId: string) {
  const supabase = createSupabaseServiceClient();

  const [
    { data: candidateEvents, error: candidateError },
    { data: existingRoles, error: roleError },
  ] = await Promise.all([
    supabase
      .from("events")
      .select(AGENT_EVENT_SELECT)
      .eq("visibility", EventVisibility.Public)
      .eq("approval_status", ApprovalStatus.Approved)
      .or("paid.eq.false,paid.is.null")
      .order("event_date", { ascending: false }),
    supabase.from("user_event_roles").select("event_id").eq("user_id", userId),
  ]);

  if (candidateError || roleError) {
    throw candidateError || roleError;
  }

  const excludedEventIds = new Set(
    (existingRoles || []).map((row) => row.event_id),
  );
  const visibleCandidates = (
    (candidateEvents || []) as AgentEventSummary[]
  ).filter((event) => !excludedEventIds.has(event.event_id));

  const candidateEventIds = visibleCandidates.map((event) => event.event_id);
  if (candidateEventIds.length === 0) {
    return [] as AgentEventSummary[];
  }

  const [
    { data: registrationBindings, error: bindingError },
    { data: questionnaireSubmissions, error: questionnaireError },
    { data: participantRoles, error: participantError },
  ] = await Promise.all([
    supabase
      .from("event_intake_form_bindings")
      .select("event_id")
      .in("event_id", candidateEventIds)
      .eq("context", "registration")
      .eq("is_active", true),
    supabase
      .from("intake_form_submissions")
      .select("event_id")
      .in("event_id", candidateEventIds)
      .eq("context", "registration")
      .eq("submitter_user_id", userId)
      .eq("status", "submitted"),
    supabase
      .from("user_event_roles")
      .select("event_id")
      .in("event_id", candidateEventIds)
      .eq("role", EventRole.Participant),
  ]);

  if (bindingError || questionnaireError || participantError) {
    throw bindingError || questionnaireError || participantError;
  }

  const eventsRequiringQuestionnaire = new Set(
    (registrationBindings || []).map((row) => row.event_id),
  );
  const completedQuestionnaires = new Set(
    (questionnaireSubmissions || []).map((row) => row.event_id),
  );
  const participantCounts = (participantRoles || []).reduce<
    Record<string, number>
  >((acc, row) => {
    acc[row.event_id] = (acc[row.event_id] || 0) + 1;
    return acc;
  }, {});

  return visibleCandidates.filter((event) => {
    if (
      eventsRequiringQuestionnaire.has(event.event_id) &&
      !completedQuestionnaires.has(event.event_id)
    ) {
      return false;
    }

    if (
      event.participant_capacity != null &&
      (participantCounts[event.event_id] || 0) >= event.participant_capacity
    ) {
      return false;
    }

    return true;
  });
}
