import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const requestSchema = z.object({ meetingId: z.string().max(36).uuid() });

/** Match meetings.getOne: standalone meetings are owner-only. */
export async function authorizeMeetingRequest(request: Request) {
  const sessionClient = await createSupabaseClient();
  const { data: { user }, error: authError } = await sessionClient.auth.getUser();
  if (authError || !user) {
    return { response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }

  // Bound actual bytes, not just Content-Length, before parsing a tiny ID payload.
  let body: unknown;
  const reader = request.body?.getReader();
  try {
    if (!reader) throw new Error("Missing body");
    const decoder = new TextDecoder();
    let bytes = 0;
    let text = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 4096) {
        void reader.cancel().catch(() => {});
        return { response: NextResponse.json({ error: "Request body too large" }, { status: 413 }) };
      }
      text += decoder.decode(value, { stream: true });
    }
    body = JSON.parse(text + decoder.decode());
  } catch {
    return { response: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) };
  } finally {
    reader?.releaseLock();
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return { response: NextResponse.json({ error: "A valid meetingId UUID is required" }, { status: 400 }) };
  }

  // Never authenticate through a service client or inherit session cookies into it.
  const service = createSupabaseServiceClient();
  const { data: meeting, error } = await service.from("meetings")
    .select("id,user_id,event_id,agent_id,status,ended_at,updated_at")
    .eq("id", parsed.data.meetingId).maybeSingle();
  if (error) throw new Error("Meeting lookup failed");
  if (!meeting) return { response: NextResponse.json({ error: "Meeting not found" }, { status: 404 }) };

  let allowed = meeting.user_id === user.id;
  if (!allowed && meeting.event_id) {
    const { data: admin, error: adminError } = await sessionClient.rpc("is_admin_user", { user_id: user.id });
    if (adminError) throw new Error("Admin lookup failed");
    allowed = admin === true;
    if (!allowed) {
      const { data: event, error: eventError } = await service.from("events")
        .select("owner_id").eq("event_id", meeting.event_id).maybeSingle();
      if (eventError) throw new Error("Event lookup failed");
      if (!event) return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
      allowed = event.owner_id === user.id;
      if (!allowed) {
        const { data: role, error: roleError } = await service.from("user_event_roles")
          .select("role").eq("event_id", meeting.event_id).eq("user_id", user.id)
          .in("role", ["organizer", "admin"]).maybeSingle();
        if (roleError) throw new Error("Event role lookup failed");
        allowed = role?.role === "organizer" || role?.role === "admin";
      }
    }
  }
  if (!allowed) return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { service, meeting, userId: user.id };
}
