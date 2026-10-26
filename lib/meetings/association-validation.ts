import type { SupabaseClient } from "@supabase/supabase-js";
import { TRPCError } from "@trpc/server";

/** The database also enforces these rules on direct client writes in stage 2. */
export async function validateMeetingAssociations(
  client: SupabaseClient,
  input: { agentId: string; eventId?: string; projectId?: string },
) {
  const { data, error } = await client.rpc("meeting_associations_allowed", {
    p_agent: input.agentId,
    p_event: input.eventId || null,
    p_project: input.projectId || null,
  });
  if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to verify meeting associations" });
  if (data !== true) throw new TRPCError({ code: "FORBIDDEN", message: "Meeting associations are not permitted" });
}
