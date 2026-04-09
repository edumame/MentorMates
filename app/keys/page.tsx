import { createSupabaseClient } from "@/app/utils/supabase/server";
import { redirect } from "next/navigation";
import KeysPageClient, { type AgentKeyRecord, type KeyEventOption } from "./keys-page-client";
import { listManagedAgentEvents, listParticipantAgentEvents } from "@/lib/agent/event-access";

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

  const [{ data: keys = [] }, managedEvents, participantEvents] = await Promise.all([
    supabase
      .from("agent_api_keys")
      .select("id, event_id, key_prefix, label, scopes, last_used_at, expires_at, created_at")
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
    listManagedAgentEvents(user.id),
    listParticipantAgentEvents(user.id),
  ]);

  return (
    <KeysPageClient
      initialKeys={(keys || []) as AgentKeyRecord[]}
      managedEventOptions={dedupeEvents(managedEvents as EventRow[])}
      participantEventOptions={dedupeEvents(participantEvents as EventRow[])}
    />
  );
}
