import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { createSupabaseClient } from "@/app/utils/supabase/server";
import { canAccessRole } from "@/features/user/roles/roles";
import { defaultRules } from "@/lib/config/constants";
import type { Database, Json } from "@/lib/database.types";
import { ApprovalStatus, EventRole, EventVisibility } from "@/lib/types";

/**
 * Duplicate an event (and its tracks/prizes) into a new draft event.
 *
 * Permission: must be an organizer of the source event (or a global admin).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const supabase = await createSupabaseClient();

    // 1) Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { eventId } = await params;
    if (!eventId) {
      return NextResponse.json(
        { error: "Event ID is required" },
        { status: 400 }
      );
    }

    // 2) Permission check (organizer or admin)
    const { data: roleRow } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();

    let isAllowed = false;
    if (
      roleRow &&
      canAccessRole(roleRow.role as EventRole, EventRole.Organizer)
    ) {
      isAllowed = true;
    } else {
      const { data: isAdmin } = await supabase.rpc("is_admin_user", {
        user_id: user.id,
      });
      isAllowed = Boolean(isAdmin);
    }

    if (!isAllowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3) Load source event
    const { data: sourceEvent, error: sourceEventError } = await supabase
      .from("events")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle();

    if (sourceEventError) {
      return NextResponse.json(
        { error: sourceEventError.message || "Failed to load event" },
        { status: 500 }
      );
    }

    if (!sourceEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // 4) Create duplicated event (draft + not submitted)
    const newEventId = randomUUID();

    const safeRules =
      (sourceEvent.rules as unknown as Json) ??
      (defaultRules as unknown as Json);

    const insertPayload: Database["public"]["Tables"]["events"]["Insert"] = {
      event_id: newEventId,
      event_name: `${sourceEvent.event_name} (Copy)`,
      event_date: sourceEvent.event_date,
      location: sourceEvent.location ?? null,
      cover_image_url: sourceEvent.cover_image_url ?? null,
      event_blurb: sourceEvent.event_blurb ?? null,
      event_description: sourceEvent.event_description ?? null,
      event_schedule: (sourceEvent.event_schedule as Json) ?? null,
      event_prizes: (sourceEvent.event_prizes as Json) ?? null,
      event_resources: (sourceEvent.event_resources as Json) ?? null,
      faq: sourceEvent.faq ?? null,
      rules: safeRules,
      scoring_config: (sourceEvent.scoring_config as Json) ?? null,
      role_labels: (sourceEvent.role_labels as Json) ?? null,
      participant_capacity: sourceEvent.participant_capacity ?? null,
      finalist_recommendation_enabled:
        sourceEvent.finalist_recommendation_enabled ?? false,
      submission_time_start: sourceEvent.submission_time_start ?? null,
      submission_time_cutoff: sourceEvent.submission_time_cutoff ?? null,

      // Important: do NOT copy payment config / Stripe ids
      paid: false,
      stripe_price_id: null,
      pricing_tiers: null,

      // Make the duplicator the owner & organizer
      owner_id: user.id,

      // Important: do NOT copy slug (must be unique)
      slug: null,

      // New event starts as draft and not submitted for approval
      visibility:
        EventVisibility.Draft as Database["public"]["Enums"]["event_visibility"],
      approval_status:
        ApprovalStatus.NotSubmitted as Database["public"]["Enums"]["approval_status"],

      // Safety: don't copy featured flag
      featured: false,
    };

    const { data: createdEvent, error: createdEventError } = await supabase
      .from("events")
      .insert(insertPayload)
      .select("*")
      .single();

    if (createdEventError || !createdEvent) {
      return NextResponse.json(
        { error: createdEventError?.message || "Failed to duplicate event" },
        { status: 500 }
      );
    }

    // 5) Ensure the current user is an organizer of the new event
    await supabase.from("user_event_roles").upsert(
      {
        user_id: user.id,
        event_id: createdEvent.event_id,
        role: EventRole.Organizer,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,event_id" }
    );

    // 6) Duplicate tracks (and prizes linked to tracks)
    const { data: sourceTracks, error: sourceTracksError } = await supabase
      .from("event_tracks")
      .select("*")
      .eq("event_id", eventId);

    if (sourceTracksError) {
      // Event is duplicated, but tracks failed. Return a partial-success response.
      return NextResponse.json(
        {
          event: createdEvent,
          warning: "Event duplicated but tracks could not be copied",
        },
        { status: 201 }
      );
    }

    const sourceTracksRows =
      (sourceTracks ?? []) as unknown as Database["public"]["Tables"]["event_tracks"]["Row"][];

    const oldToNewTrackId = new Map<string, string>();

    if (sourceTracksRows.length > 0) {
      const trackInserts: Database["public"]["Tables"]["event_tracks"]["Insert"][] =
        [];

      for (const t of sourceTracksRows) {
        const newTrackId = randomUUID();
        oldToNewTrackId.set(t.track_id, newTrackId);
        trackInserts.push({
          event_id: createdEvent.event_id,
          track_id: newTrackId,
          name: t.name,
          description: t.description ?? null,
          label: t.label ?? null,
          prize_amount: t.prize_amount ?? null,
          prize_description: t.prize_description ?? null,
          scoring_criteria: (t.scoring_criteria as Json) ?? null,
          updated_at: new Date().toISOString(),
        });
      }

      const { error: insertTracksError } = await supabase
        .from("event_tracks")
        .insert(trackInserts);

      if (insertTracksError) {
        return NextResponse.json(
          {
            event: createdEvent,
            warning: "Event duplicated but tracks could not be copied",
          },
          { status: 201 }
        );
      }

      // Copy prizes that belong to those tracks
      const oldTrackIds: string[] = [];
      for (const t of sourceTracksRows) oldTrackIds.push(t.track_id);
      const { data: sourcePrizes } = await supabase
        .from("prizes")
        .select("track_id, prize_amount, prize_description")
        .in("track_id", oldTrackIds);

      const sourcePrizesRows =
        (sourcePrizes ?? []) as unknown as Array<
          Pick<
            Database["public"]["Tables"]["prizes"]["Row"],
            "track_id" | "prize_amount" | "prize_description"
          >
        >;

      if (sourcePrizesRows.length > 0) {
        const typedSourcePrizes = sourcePrizesRows as Array<
          Pick<
            Database["public"]["Tables"]["prizes"]["Row"],
            "track_id" | "prize_amount" | "prize_description"
          >
        >;

        // Build a clean insert payload (skip prizes whose tracks couldn't be mapped)
        const prizeInserts: Database["public"]["Tables"]["prizes"]["Insert"][] =
          [];

        for (const p of typedSourcePrizes) {
          const newTrackId = oldToNewTrackId.get(p.track_id);
          if (!newTrackId) continue;
          prizeInserts.push({
            track_id: newTrackId,
            prize_amount: p.prize_amount,
            prize_description: p.prize_description,
            updated_at: new Date().toISOString(),
          });
        }

        if (prizeInserts.length > 0) {
          await supabase.from("prizes").insert(prizeInserts);
        }
      }
    }

    // 7) Duplicate event agents (only the current user's agents for this event)
    // Notes:
    // - Agents are user-owned (user_id). We can't copy other users' agents without
    //   violating RLS. So we only copy agents created by the current user.
    // - Meetings or run history are NOT copied.
    // - We generate new agent ids so that event settings can remap safely.
    const oldToNewAgentId = new Map<string, string>();
    const { data: sourceAgents, error: sourceAgentsError } = await supabase
      .from("agents")
      .select("id,name,instructions,enabled,type,custom_type,avatar_url")
      .eq("event_id", eventId)
      .eq("user_id", user.id);

    if (!sourceAgentsError && sourceAgents && sourceAgents.length > 0) {
      const agentInserts: Array<Record<string, unknown>> = [];

      for (const a of sourceAgents as Array<Record<string, unknown>>) {
        const oldId = typeof a.id === "string" ? a.id : null;
        const newId = randomUUID();
        if (oldId) oldToNewAgentId.set(oldId, newId);

        const type = String(a.type ?? "brainstorm");
        const customType =
          type === "custom" ? String(a.custom_type ?? "Custom") : null;

        agentInserts.push({
          id: newId,
          name: a.name ?? "Agent",
          instructions: a.instructions ?? "",
          enabled: a.enabled ?? true,
          type,
          custom_type: customType,
          avatar_url: a.avatar_url ?? null,
          event_id: createdEvent.event_id,
          user_id: user.id,
          updated_at: new Date().toISOString(),
        });
      }

      if (agentInserts.length > 0) {
        await supabase.from("agents").insert(agentInserts);
      }
    }

    // 8) Copy event session caps (and remap per-agent overrides to new agent ids)
    // session_caps shape:
    // {
    //   default: number | null,
    //   agent_caps: Record<agentId, number | null>
    // }
    const { data: sourceCapsRow, error: sourceCapsError } = await supabase
      .from("events")
      .select("session_caps")
      .eq("event_id", eventId)
      .maybeSingle();

    if (!sourceCapsError && sourceCapsRow) {
      const caps = (sourceCapsRow as unknown as { session_caps?: unknown })
        .session_caps;

      if (caps && typeof caps === "object") {
        const capsObj = caps as {
          default?: unknown;
          agent_caps?: unknown;
        };

        const nextCaps: Record<string, unknown> = {
          default: capsObj.default ?? null,
          agent_caps: {},
        };

        const agentCaps =
          capsObj.agent_caps && typeof capsObj.agent_caps === "object"
            ? (capsObj.agent_caps as Record<string, unknown>)
            : {};

        const remapped: Record<string, unknown> = {};
        for (const [oldAgentId, cap] of Object.entries(agentCaps)) {
          const newAgentId = oldToNewAgentId.get(oldAgentId);
          if (!newAgentId) continue;
          remapped[newAgentId] = cap;
        }

        nextCaps.agent_caps = remapped;

        await supabase
          .from("events")
          .update({ session_caps: nextCaps } as unknown as Record<
            string,
            unknown
          >)
          .eq("event_id", createdEvent.event_id);
      }
    }

    // 7) Done
    return NextResponse.json({ event: createdEvent }, { status: 201 });
  } catch (error) {
    console.error("Error duplicating event:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

