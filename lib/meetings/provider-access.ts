import { TRPCError } from "@trpc/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/** Uses the verified protectedProcedure identity and session client; no service bypass. */
export async function authorizeMeetingProvider(supabase: SupabaseClient<Database>, userId: string, id: string) {
  const failure = () => new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to verify meeting access" });
  const { data: meeting, error } = await supabase.from("meetings").select("*").eq("id", id).maybeSingle();
  if (error) throw failure();
  if (!meeting) throw new TRPCError({ code: "NOT_FOUND", message: "Meeting not found" });
  if (meeting.user_id === userId) return meeting;
  if (meeting.event_id) {
    const { data: admin, error: adminError } = await supabase.rpc("is_admin_user", { user_id: userId });
    if (adminError) throw failure();
    if (admin === true) return meeting;
    const { data: event, error: eventError } = await supabase.from("events").select("owner_id").eq("event_id", meeting.event_id).maybeSingle();
    if (eventError) throw failure();
    if (event?.owner_id === userId) return meeting;
    if (event) {
      const { data: role, error: roleError } = await supabase.from("user_event_roles").select("role")
        .eq("event_id", meeting.event_id).eq("user_id", userId).in("role", ["organizer", "admin"]).maybeSingle();
      if (roleError) throw failure();
      if (role?.role === "organizer" || role?.role === "admin") return meeting;
    }
  }
  throw new TRPCError({ code: "FORBIDDEN", message: "Meeting access denied" });
}

/** Installed Video SDK exposes HTTP status in StreamError.metadata.responseCode. */
export function isMissingVideoCall(error: unknown): boolean {
  return typeof error === "object" && error !== null && "metadata" in error &&
    typeof error.metadata === "object" && error.metadata !== null &&
    "responseCode" in error.metadata && error.metadata.responseCode === 404;
}
