import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EventRole } from "@/lib/types";

export async function GET() {
  try {
    const supabase = await createSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: roleRows, error: roleError } = await supabase
      .from("user_event_roles")
      .select("event_id, role")
      .eq("user_id", user.id);

    if (roleError) {
      return NextResponse.json(
        { error: "Failed to fetch user event roles" },
        { status: 500 }
      );
    }

    const participantEventIds =
      roleRows
        ?.filter((row) => row.role === EventRole.Participant)
        .map((row) => row.event_id) ?? [];

    if (participantEventIds.length === 0) {
      return NextResponse.json({ events: [] });
    }

    const { data: eventsData, error: eventsError } = await supabase
      .from("events")
      .select(
        "event_id, event_name, slug, submission_time_start, submission_time_cutoff"
      )
      .in("event_id", participantEventIds);

    if (eventsError) {
      return NextResponse.json(
        { error: "Failed to fetch events" },
        { status: 500 }
      );
    }

    const now = Date.now();
    const events =
      eventsData
        ?.filter((event) => {
          const start = event.submission_time_start
            ? new Date(event.submission_time_start).getTime()
            : null;
          const cutoff = event.submission_time_cutoff
            ? new Date(event.submission_time_cutoff).getTime()
            : null;
          const hasStarted = !start || start <= now;
          const beforeDeadline = !cutoff || cutoff >= now;
          return hasStarted && beforeDeadline;
        })
        .sort((a, b) => {
          const cutoffA = a.submission_time_cutoff
            ? new Date(a.submission_time_cutoff).getTime()
            : Number.POSITIVE_INFINITY;
          const cutoffB = b.submission_time_cutoff
            ? new Date(b.submission_time_cutoff).getTime()
            : Number.POSITIVE_INFINITY;
          return cutoffA - cutoffB;
        }) ?? [];

    return NextResponse.json({ events });
  } catch (error) {
    console.error("Error fetching assignable events:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
