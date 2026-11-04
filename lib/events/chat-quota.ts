import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const decisionSchema = z
  .array(z.object({ allowed: z.boolean(), retry_after_seconds: z.number().int().min(0).max(3600) }))
  .length(1);

/** Reserves one assistant turn. The caller supplies only the ID from auth.getUser. */
export async function reserveEventChatTurn(verifiedUserId: string) {
  const { data, error } = await createSupabaseServiceClient().rpc("reserve_event_chat_request", {
    p_user_id: verifiedUserId,
  });
  const parsed = decisionSchema.safeParse(data);
  if (error || !parsed.success) throw new Error("Could not reserve an event chat turn");
  return parsed.data[0];
}
