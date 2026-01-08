import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { ApprovalStatus, EventRole, EventVisibility } from "@/lib/types";
import { canAccessRole } from "@/features/user/roles/roles";
import type { Database } from "@/lib/database.types";

type Supabase = SupabaseClient<Database>;
type EventRow = Database["public"]["Tables"]["events"]["Row"] & {
  event_tracks?: Array<
    Database["public"]["Tables"]["event_tracks"]["Row"] & {
      prizes?: Database["public"]["Tables"]["prizes"]["Row"][];
    }
  >;
};
type LessonRow = {
  title: string;
  cover_image_url: string;
  url: string;
  description: string;
  duration_minutes: number;
};
type PricingTierRow = Database["public"]["Tables"]["pricing_tiers"]["Row"];
type RolePasswordRow = Database["public"]["Tables"]["role_passwords"]["Row"];
type OrganizerRoleRow = { user_id: string; role: string };

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const supabase = await createSupabaseClient();
  let newEventId: string | null = null;

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { eventId } = await params;
    if (!eventId) {
      return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
    }

    const { data: roleRow } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();

    let isAllowed = false;
    if (roleRow && canAccessRole(roleRow.role as EventRole, EventRole.Organizer)) {
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

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select(
        `
        *,
        event_tracks (
          track_id,
          name,
          description,
          label,
          scoring_criteria,
          prize_amount,
          prize_description,
          prizes (
            id,
            prize_amount,
            prize_description
          )
        )
      `
      )
      .eq("event_id", eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const [lessons, pricingTiers, rolePasswords, organizerRoles] = await Promise.all([
      fetchLessons(supabase, eventId),
      fetchPricingTiers(supabase, eventId),
      fetchRolePasswords(supabase, eventId),
      fetchOrganizers(supabase, eventId),
    ]);

    const newSlug = await generateUniqueSlug(
      supabase,
      event.slug ?? event.event_name ?? null
    );

    const insertPayload = buildEventInsertPayload(
      event as EventRow,
      user.id,
      newSlug
    );

    const { data: newEvent, error: insertError } = await supabase
      .from("events")
      .insert(insertPayload)
      .select("*")
      .single();

    if (insertError || !newEvent) {
      return NextResponse.json(
        { error: insertError?.message || "Failed to duplicate event" },
        { status: 500 }
      );
    }

    newEventId = newEvent.event_id;

    const { error: ensureOrganizerError } = await supabase
      .from("user_event_roles")
      .upsert(
        {
          user_id: user.id,
          event_id: newEventId,
          role: EventRole.Organizer,
        },
        { onConflict: "user_id,event_id" }
      );

    if (ensureOrganizerError) {
      throw ensureOrganizerError;
    }

    const organizerInserts =
      organizerRoles
        ?.filter((organizer) => organizer.user_id !== user.id)
        .map((organizer) => ({
          user_id: organizer.user_id,
          event_id: newEventId,
          role: organizer.role,
        })) ?? [];

    if (organizerInserts.length > 0) {
      const { error: organizerInsertError } = await supabase
        .from("user_event_roles")
        .insert(organizerInserts);
      if (organizerInsertError) {
        throw organizerInsertError;
      }
    }

    await copyTracksAndPrizes(event as EventRow, newEventId, supabase);

    if (lessons.length > 0) {
      await copyLessons(lessons, newEventId, supabase);
    }

    if (pricingTiers.length > 0) {
      await copyPricingTiers(pricingTiers, newEventId, supabase);
    }

    if (rolePasswords.length > 0) {
      await copyRolePasswords(rolePasswords, newEventId, supabase);
    }

    if (event.paid) {
      const { error: updatePaidError } = await supabase
        .from("events")
        .update({ paid: event.paid })
        .eq("event_id", newEventId);
      if (updatePaidError) {
        throw updatePaidError;
      }
    }

    return NextResponse.json({
      success: true,
      eventId: newEvent.event_id,
      slug: newEvent.slug,
    });
  } catch (error) {
    console.error("Error duplicating event:", error);
    if (newEventId) {
      await cleanupDuplicatedEvent(supabase, newEventId);
    }
    return NextResponse.json(
      { error: "Failed to duplicate event" },
      { status: 500 }
    );
  }
}

const buildCopyName = (name: string) => {
  if (!name) return "Untitled Event (Copy)";
  if (!name.toLowerCase().includes("(copy")) {
    return `${name} (Copy)`;
  }
  const copyMatch = name.match(/\(copy(?: (\d+))?\)$/i);
  if (!copyMatch) {
    return `${name} (Copy)`;
  }
  const next = copyMatch[1] ? parseInt(copyMatch[1], 10) + 1 : 2;
  return name.replace(/\(copy(?: (\d+))?\)$/i, `(Copy ${next})`);
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 60);

const generateUniqueSlug = async (
  supabase: Supabase,
  source?: string | null
): Promise<string | null> => {
  if (!source) return null;
  const base = slugify(source);
  if (!base) return null;

  let candidate = `${base}-copy`;
  let attempts = 0;

  while (attempts < 5) {
    const { data } = await supabase
      .from("events")
      .select("event_id")
      .eq("slug", candidate)
      .maybeSingle();

    if (!data) {
      return candidate;
    }
    candidate = `${base}-copy-${Math.random().toString(36).slice(2, 6)}`;
    attempts += 1;
  }

  return `${base}-copy-${randomUUID().slice(0, 4)}`;
};

const buildEventInsertPayload = (
  event: EventRow,
  userId: string,
  slug: string | null
): Database["public"]["Tables"]["events"]["Insert"] => {
  const clone: Record<string, unknown> = { ...event };

  delete clone.event_id;
  delete clone.created_at;
  delete clone.updated_at;
  delete clone.event_tracks;
  delete clone.event_lessons;
  delete clone.owner_id;
  delete clone.userRole;

  clone.event_name = buildCopyName(event.event_name);
  clone.slug = slug;
  clone.visibility = EventVisibility.Draft;
  clone.approval_status = ApprovalStatus.NotSubmitted;
  clone.owner_id = userId;
  clone.featured = false;
  clone.paid = event.paid ? false : event.paid ?? false;

  return clone as Database["public"]["Tables"]["events"]["Insert"];
};

const fetchLessons = async (supabase: Supabase, eventId: string) => {
  const { data, error } = await supabase
    .from("event_lessons")
    .select("title,cover_image_url,url,description,duration_minutes")
    .eq("event_id", eventId);

  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }

  return (data || []) as LessonRow[];
};

const fetchPricingTiers = async (supabase: Supabase, eventId: string) => {
  const { data, error } = await supabase
    .from("pricing_tiers")
    .select("*")
    .eq("event_id", eventId);

  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }

  return (data || []) as PricingTierRow[];
};

const fetchRolePasswords = async (supabase: Supabase, eventId: string) => {
  const { data, error } = await supabase
    .from("role_passwords")
    .select("*")
    .eq("event_id", eventId);

  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }

  return (data || []) as RolePasswordRow[];
};

const fetchOrganizers = async (supabase: Supabase, eventId: string) => {
  const { data, error } = await supabase
    .from("user_event_roles")
    .select("user_id,role")
    .eq("event_id", eventId)
    .eq("role", EventRole.Organizer);

  if (error) {
    throw error;
  }

  return (data || []) as OrganizerRoleRow[];
};

const copyTracksAndPrizes = async (
  event: EventRow,
  newEventId: string,
  supabase: Supabase
) => {
  if (!event.event_tracks || event.event_tracks.length === 0) {
    return;
  }

  const trackIdMap = new Map<string, string>();
  const trackInserts = event.event_tracks.map((track) => {
    const newTrackId = randomUUID();
    trackIdMap.set(track.track_id, newTrackId);
    return {
      track_id: newTrackId,
      event_id: newEventId,
      name: track.name,
      description: track.description,
      label: track.label,
      scoring_criteria: track.scoring_criteria,
      prize_amount: track.prize_amount,
      prize_description: track.prize_description,
    };
  });

  const { error: trackInsertError } = await supabase
    .from("event_tracks")
    .insert(trackInserts);

  if (trackInsertError) {
    throw trackInsertError;
  }

  const prizeInserts: Array<{
    track_id: string;
    prize_amount: string;
    prize_description: string;
  }> = [];

  event.event_tracks.forEach((track) => {
    if (!track.prizes || track.prizes.length === 0) return;
    const mappedTrackId = trackIdMap.get(track.track_id);
    if (!mappedTrackId) return;
    track.prizes.forEach((prize) => {
      prizeInserts.push({
        track_id: mappedTrackId,
        prize_amount: prize.prize_amount,
        prize_description: prize.prize_description,
      });
    });
  });

  if (prizeInserts.length > 0) {
    const { error: prizeInsertError } = await supabase
      .from("prizes")
      .insert(prizeInserts);
    if (prizeInsertError) {
      throw prizeInsertError;
    }
  }
};

const copyLessons = async (
  lessons: LessonRow[],
  newEventId: string,
  supabase: Supabase
) => {
  const lessonPayloads = lessons.map((lesson) => ({
    event_id: newEventId,
    title: lesson.title,
    cover_image_url: lesson.cover_image_url,
    url: lesson.url,
    description: lesson.description,
    duration_minutes: lesson.duration_minutes,
  }));

  const { error } = await supabase.from("event_lessons").insert(lessonPayloads);
  if (error) throw error;
};

const copyPricingTiers = async (
  tiers: PricingTierRow[],
  newEventId: string,
  supabase: Supabase
) => {
  const payloads = tiers.map((tier) => ({
    event_id: newEventId,
    tier_id: tier.tier_id,
    name: tier.name,
    price: tier.price,
    stripe_price_id: tier.stripe_price_id,
    description: tier.description,
    available_until: tier.available_until,
    max_quantity: tier.max_quantity,
    current_quantity: 0,
    is_active: tier.is_active,
    sort_order: tier.sort_order,
    bundle_size: tier.bundle_size,
  }));

  const { error } = await supabase.from("pricing_tiers").insert(payloads);
  if (error) throw error;
};

const copyRolePasswords = async (
  passwords: RolePasswordRow[],
  newEventId: string,
  supabase: Supabase
) => {
  const payloads = passwords.map((password) => ({
    event_id: newEventId,
    role: password.role,
    password_hash: password.password_hash,
  }));

  const { error } = await supabase.from("role_passwords").insert(payloads);
  if (error) throw error;
};

const cleanupDuplicatedEvent = async (supabase: Supabase, eventId: string) => {
  try {
    const { data: trackRows } = await supabase
      .from("event_tracks")
      .select("track_id")
      .eq("event_id", eventId);
    const trackIds = (trackRows || []).map((row) => row.track_id);
    if (trackIds.length > 0) {
      await safeDelete(() =>
        supabase.from("prizes").delete().in("track_id", trackIds)
      );
    }
  } catch (trackFetchError) {
    console.error("Cleanup error fetching track IDs:", trackFetchError);
  }

  await safeDelete(() =>
    supabase.from("event_tracks").delete().eq("event_id", eventId)
  );
  await safeDelete(() =>
    supabase.from("pricing_tiers").delete().eq("event_id", eventId)
  );
  await safeDelete(() =>
    supabase.from("event_lessons").delete().eq("event_id", eventId)
  );
  await safeDelete(() =>
    supabase.from("role_passwords").delete().eq("event_id", eventId)
  );
  await safeDelete(() =>
    supabase.from("user_event_roles").delete().eq("event_id", eventId)
  );
  await safeDelete(() => supabase.from("events").delete().eq("event_id", eventId));
};

const safeDelete = async (
  action: () => Promise<{ error: { code?: string } | null }>
) => {
  try {
    const { error } = await action();
    if (error && error.code !== "42P01") {
      console.error("Cleanup delete error:", error);
    }
  } catch (err) {
    console.error("Cleanup delete threw:", err);
  }
};
