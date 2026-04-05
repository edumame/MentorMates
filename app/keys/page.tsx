import { createSupabaseClient } from "@/app/utils/supabase/server";
import { redirect } from "next/navigation";
import KeysPageClient, { type AgentKeyRecord, type KeyEventOption } from "./keys-page-client";

type EventRow = {
  event_id: string;
  event_name: string | null;
  event_date: string | null;
};

function dedupeEvents(rows: EventRow[]): KeyEventOption[] {
  const byId = new Map<string, KeyEventOption>();

  rows.forEach((row) => {
    if (!row.event_id) return;
    byId.set(row.event_id, {
      id: row.event_id,
      name: row.event_name || row.event_id,
      eventDate: row.event_date,
    });
  });

  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export default async function KeysPage() {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/sign-in");
  }

  const { data: isAdminRpc } = await supabase.rpc("is_admin_user", {
    user_id: user.id,
  });
  const isAdmin = Boolean(isAdminRpc);

  const [{ data: keys = [] }, { data: ownedEvents = [] }, { data: organizerRoles = [] }] =
    await Promise.all([
      supabase
        .from("agent_api_keys")
        .select("id, event_id, key_prefix, label, scopes, last_used_at, expires_at, created_at")
        .eq("user_id", user.id)
        .is("revoked_at", null)
        .order("created_at", { ascending: false }),
      isAdmin
        ? Promise.resolve({ data: [] as EventRow[] })
        : supabase
            .from("events")
            .select("event_id, event_name, event_date")
            .eq("owner_id", user.id),
      isAdmin
        ? Promise.resolve({ data: [] as { event_id: string }[] })
        : supabase
            .from("user_event_roles")
            .select("event_id")
            .eq("user_id", user.id)
            .eq("role", "organizer"),
    ]);

  let eventOptions: KeyEventOption[] = [];

  if (isAdmin) {
    const { data: adminEvents = [] } = await supabase
      .from("events")
      .select("event_id, event_name, event_date")
      .order("event_date", { ascending: false })
      .limit(200);
    eventOptions = dedupeEvents(adminEvents as EventRow[]);
  } else {
    const organizerEventIds = Array.from(
      new Set((organizerRoles || []).map((row) => row.event_id).filter(Boolean))
    );

    let organizerEvents: EventRow[] = [];
    if (organizerEventIds.length > 0) {
      const { data } = await supabase
        .from("events")
        .select("event_id, event_name, event_date")
        .in("event_id", organizerEventIds);
      organizerEvents = (data || []) as EventRow[];
    }

    eventOptions = dedupeEvents([
      ...(ownedEvents as EventRow[]),
      ...organizerEvents,
    ]);
  }

  return (
    <KeysPageClient
      initialKeys={(keys || []) as AgentKeyRecord[]}
      eventOptions={eventOptions}
    />
  );
}
